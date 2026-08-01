-- 0014  Enquiry submission, lifecycle enforcement, messaging, notifications.
-- PRD 6.5-6.7, 9.4, 10, Epic C.
--
-- The lifecycle is enforced by TRIGGERS, not by the service layer alone. The
-- `enquiries: participant update` policy from 0005 lets a participant write the
-- row, and RLS is row-level — so without this, a customer could PATCH
-- status='booked' straight through PostgREST and skip the transition map
-- entirely (PRD 6.6: "state transitions are validated server-side").

-- ---------------------------------------------------------------------------
-- 1. The transition map, as data.
--
-- Mirrors src/features/enquiries/status.ts. A table rather than a function so
-- tests/enquiry-transitions.test.ts can diff the two and fail on drift — the
-- gap ADR-004 flagged for the permission catalogue.
-- ---------------------------------------------------------------------------

create table public.enquiry_transitions (
  from_status     public.enquiry_status not null,
  to_status       public.enquiry_status not null,
  actor_type      public.actor_type not null,
  requires_reason boolean not null default false,
  primary key (from_status, to_status, actor_type)
);

alter table public.enquiry_transitions enable row level security;

create policy "enquiry_transitions: read"
  on public.enquiry_transitions for select to anon, authenticated using (true);

insert into public.enquiry_transitions (from_status, to_status, actor_type, requires_reason) values
  ('draft',       'submitted',   'customer', false),

  ('submitted',   'delivered',   'system',   false),
  ('submitted',   'spam',        'admin',    true),

  ('delivered',   'viewed',      'vendor',   false),
  ('delivered',   'contacted',   'vendor',   false),
  ('delivered',   'closed',      'customer', true),
  ('delivered',   'closed',      'admin',    true),
  ('delivered',   'spam',        'vendor',   true),
  ('delivered',   'spam',        'admin',    true),

  ('viewed',      'contacted',   'vendor',   false),
  ('viewed',      'qualified',   'vendor',   false),
  ('viewed',      'not_booked',  'vendor',   true),
  ('viewed',      'closed',      'customer', true),
  ('viewed',      'closed',      'admin',    true),
  ('viewed',      'spam',        'vendor',   true),
  ('viewed',      'spam',        'admin',    true),

  ('contacted',   'qualified',   'vendor',   false),
  ('contacted',   'not_booked',  'vendor',   true),
  ('contacted',   'closed',      'customer', true),
  ('contacted',   'closed',      'admin',    true),
  ('contacted',   'spam',        'vendor',   true),
  ('contacted',   'spam',        'admin',    true),

  ('qualified',   'quote_sent',  'vendor',   false),
  ('qualified',   'not_booked',  'vendor',   true),
  ('qualified',   'closed',      'customer', true),
  ('qualified',   'closed',      'admin',    true),

  ('quote_sent',  'negotiating', 'vendor',   false),
  ('quote_sent',  'negotiating', 'customer', false),
  ('quote_sent',  'booked',      'vendor',   false),
  ('quote_sent',  'booked',      'customer', false),
  ('quote_sent',  'not_booked',  'vendor',   true),
  ('quote_sent',  'closed',      'customer', true),
  ('quote_sent',  'closed',      'admin',    true),

  ('negotiating', 'booked',      'vendor',   false),
  ('negotiating', 'booked',      'customer', false),
  ('negotiating', 'not_booked',  'vendor',   true),
  ('negotiating', 'closed',      'customer', true),
  ('negotiating', 'closed',      'admin',    true),

  ('booked',      'closed',      'customer', false),
  ('booked',      'closed',      'vendor',   false),
  ('booked',      'closed',      'admin',    false),

  ('not_booked',  'closed',      'customer', false),
  ('not_booked',  'closed',      'vendor',   false),
  ('not_booked',  'closed',      'admin',    false),

  ('closed',      'negotiating', 'admin',    true),
  ('spam',        'delivered',   'admin',    true);

-- ---------------------------------------------------------------------------
-- 2. Who is acting on this enquiry?
-- ---------------------------------------------------------------------------

create or replace function public.enquiry_actor_type(target_enquiry uuid)
returns public.actor_type
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.enquiries%rowtype;
  uid uuid := (select auth.uid());
begin
  select * into e from public.enquiries where id = target_enquiry;
  if not found or uid is null then return 'system'; end if;

  if e.customer_id = uid then return 'customer'; end if;
  if public.is_vendor_member(e.vendor_id) then return 'vendor'; end if;
  if public.has_admin_permission('lead.read') then return 'admin'; end if;
  return 'system';
end;
$$;

revoke execute on function public.enquiry_actor_type(uuid) from public;
grant execute on function public.enquiry_actor_type(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Enforce transitions, and record every one.
--
-- `_transition_reason` is a per-transaction setting rather than a column: the
-- reason belongs to the event, not to the enquiry row.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_enquiry_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor      public.actor_type;
  rule       public.enquiry_transitions%rowtype;
  reason     text := nullif(current_setting('app.transition_reason', true), '');
  is_service boolean := (select auth.uid()) is null;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Background jobs and webhooks run without a JWT; they are trusted callers.
  if is_service then
    return new;
  end if;

  actor := public.enquiry_actor_type(new.id);

  select * into rule
  from public.enquiry_transitions
  where from_status = old.status and to_status = new.status and actor_type = actor;

  if not found then
    raise exception 'A % cannot move an enquiry from % to %.', actor, old.status, new.status
      using errcode = '42501';
  end if;

  if rule.requires_reason and coalesce(trim(reason), '') = '' then
    raise exception 'A reason is required to move an enquiry to %.', new.status
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger enquiries_enforce_transition
  before update of status on public.enquiries
  for each row execute function public.enforce_enquiry_transition();

/* Every transition writes an event, whatever path performed it (PRD 6.6). */
create or replace function public.record_enquiry_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  insert into public.enquiry_events
    (enquiry_id, actor_user_id, actor_type, event_type, from_status, to_status, reason)
  values (
    new.id,
    (select auth.uid()),
    coalesce(public.enquiry_actor_type(new.id), 'system'),
    'status_changed',
    old.status,
    new.status,
    nullif(current_setting('app.transition_reason', true), '')
  );

  return null;
end;
$$;

create trigger enquiries_record_transition
  after update of status on public.enquiries
  for each row execute function public.record_enquiry_transition();

-- ---------------------------------------------------------------------------
-- 4. Notification fan-out helper. `notifications` has no user insert policy;
--    only SECURITY DEFINER code writes it.
-- ---------------------------------------------------------------------------

create or replace function public.queue_notification(
  target_user uuid,
  code        text,
  payload     jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, code, channel, payload_json, status)
  select target_user, code, 'in_app', payload, 'queued'
  where target_user is not null
    and coalesce(
      (select np.enabled from public.notification_preferences np
        where np.user_id = target_user and np.channel = 'in_app'
          and np.notification_group = split_part(code, '.', 1)),
      true
    );
$$;

-- ---------------------------------------------------------------------------
-- 5. submit_enquiry — idempotent, atomic, and rate limited (PRD 6.6, 10.3).
-- ---------------------------------------------------------------------------

create or replace function public.submit_enquiry(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid         uuid := (select auth.uid());
  target      uuid := (payload ->> 'vendorId')::uuid;
  idem        text := nullif(payload ->> 'idempotencyKey', '');
  existing    public.enquiries%rowtype;
  vendor      public.vendors%rowtype;
  new_id      uuid;
  recent      integer;
  duplicate   boolean;
begin
  if uid is null then
    raise exception 'Please sign in to send an enquiry.' using errcode = '42501';
  end if;

  -- Idempotency first: a retried submission must return the original, not a
  -- second enquiry (PRD 10.3, 15).
  if idem is not null then
    select * into existing from public.enquiries
    where customer_id = uid and idempotency_key = idem;
    if found then
      return jsonb_build_object('ok', true, 'enquiryId', existing.id, 'duplicate', true);
    end if;
  end if;

  select * into vendor from public.vendors where id = target;
  if not found or vendor.status <> 'active' then
    raise exception 'That business is not accepting enquiries.' using errcode = 'P0002';
  end if;

  -- Rate limit (PRD 10.3). Generous enough for genuine planning, tight enough
  -- to blunt scripted abuse.
  select count(*) into recent from public.enquiries
  where customer_id = uid and created_at > now() - interval '1 hour';
  if recent >= 20 then
    raise exception 'You have sent a lot of enquiries in the last hour. Please try again later.'
      using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.enquiries
    where customer_id = uid and vendor_id = target
      and created_at > now() - interval '24 hours'
      and status not in ('closed', 'not_booked', 'spam')
  ) into duplicate;

  insert into public.enquiries (
    customer_id, vendor_id, category_id, city_id,
    event_date, flexible_date, budget_min_minor, budget_max_minor, currency,
    guest_count, requirements_json, message, preferred_contact_mode,
    contact_consent, idempotency_key, status, delivered_at
  ) values (
    uid,
    target,
    nullif(payload ->> 'categoryId', '')::uuid,
    nullif(payload ->> 'cityId', '')::uuid,
    nullif(payload ->> 'eventDate', '')::date,
    nullif(payload ->> 'flexibleDate', ''),
    nullif(payload ->> 'budgetMinMinor', '')::bigint,
    nullif(payload ->> 'budgetMaxMinor', '')::bigint,
    coalesce(nullif(payload ->> 'currency', ''), 'INR'),
    nullif(payload ->> 'guestCount', '')::integer,
    coalesce(payload -> 'requirements', '{}'::jsonb),
    nullif(payload ->> 'message', ''),
    nullif(payload ->> 'preferredContactMode', ''),
    coalesce((payload ->> 'contactConsent')::boolean, false),
    idem,
    -- Delivery is immediate here because there is no external hand-off yet;
    -- the timestamp is what starts the vendor's first-response clock.
    'delivered',
    now()
  )
  returning id into new_id;

  -- The status trigger only fires on UPDATE, so the opening events are written
  -- explicitly.
  insert into public.enquiry_events (enquiry_id, actor_user_id, actor_type, event_type, to_status)
  values (new_id, uid, 'customer', 'enquiry_submitted', 'submitted');

  insert into public.enquiry_events
    (enquiry_id, actor_user_id, actor_type, event_type, from_status, to_status)
  values (new_id, null, 'system', 'enquiry_delivered', 'submitted', 'delivered');

  insert into public.conversations (enquiry_id, status) values (new_id, 'open');

  -- Notify every active member of the vendor.
  perform public.queue_notification(
    m.user_id,
    'enquiry.new',
    jsonb_build_object('enquiryId', new_id, 'vendorId', target, 'vendorName', vendor.display_name)
  )
  from public.vendor_memberships m
  where m.vendor_id = target and m.status = 'active';

  return jsonb_build_object(
    'ok', true,
    'enquiryId', new_id,
    'duplicate', false,
    'duplicateWarning', duplicate
  );
end;
$$;

revoke execute on function public.submit_enquiry(jsonb) from public;
grant execute on function public.submit_enquiry(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. transition_enquiry — passes the reason to the triggers.
-- ---------------------------------------------------------------------------

create or replace function public.transition_enquiry(
  target_enquiry uuid,
  next_status    public.enquiry_status,
  reason         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_access_enquiry(target_enquiry) then
    raise exception 'You do not have access to that enquiry.' using errcode = '42501';
  end if;

  -- Read back by the BEFORE/AFTER triggers on this transaction only.
  perform set_config('app.transition_reason', coalesce(reason, ''), true);

  update public.enquiries set status = next_status where id = target_enquiry;

  perform set_config('app.transition_reason', '', true);

  return jsonb_build_object('ok', true, 'status', next_status);
end;
$$;

revoke execute on function public.transition_enquiry(uuid, public.enquiry_status, text) from public;
grant execute on function public.transition_enquiry(uuid, public.enquiry_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Messaging: notify the other participant, and start the response clock.
-- ---------------------------------------------------------------------------

create or replace function public.on_message_sent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e      public.enquiries%rowtype;
  sender uuid := new.sender_user_id;
begin
  select en.* into e
  from public.enquiries en
  join public.conversations c on c.enquiry_id = en.id
  where c.id = new.conversation_id;

  if not found then return null; end if;

  if sender = e.customer_id then
    -- Vendor side hears about it.
    perform public.queue_notification(
      m.user_id, 'message.new',
      jsonb_build_object('enquiryId', e.id, 'from', 'customer')
    )
    from public.vendor_memberships m
    where m.vendor_id = e.vendor_id and m.status = 'active';
  else
    perform public.queue_notification(
      e.customer_id, 'message.new',
      jsonb_build_object('enquiryId', e.id, 'from', 'vendor')
    );

    -- First vendor reply stops the SLA clock (PRD 6.6).
    if e.first_response_at is null then
      update public.enquiries set first_response_at = now() where id = e.id;
      insert into public.enquiry_events (enquiry_id, actor_user_id, actor_type, event_type)
      values (e.id, sender, 'vendor', 'first_response');
    end if;
  end if;

  insert into public.enquiry_events (enquiry_id, actor_user_id, actor_type, event_type)
  values (e.id, sender, case when sender = e.customer_id then 'customer' else 'vendor' end,
          'message_sent');

  return null;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.on_message_sent();

-- ---------------------------------------------------------------------------
-- 8. A vendor opening an enquiry marks it viewed, once.
-- ---------------------------------------------------------------------------

create or replace function public.mark_enquiry_viewed(target_enquiry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enquiries%rowtype;
begin
  select * into e from public.enquiries where id = target_enquiry;
  if not found then return; end if;
  if e.status <> 'delivered' then return; end if;
  if not public.is_vendor_member(e.vendor_id) then return; end if;

  perform set_config('app.transition_reason', '', true);
  update public.enquiries set status = 'viewed' where id = target_enquiry;
end;
$$;

revoke execute on function public.mark_enquiry_viewed(uuid) from public;
grant execute on function public.mark_enquiry_viewed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Indexes for the customer and vendor list views.
-- ---------------------------------------------------------------------------

create index if not exists enquiries_customer_status_idx
  on public.enquiries (customer_id, status, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id, read_at) where read_at is null;
