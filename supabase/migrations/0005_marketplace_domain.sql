-- 0005  Wedding profiles, shortlists, enquiries, messaging, reviews.
-- PRD 9.4, 6.5-6.8, 10.2.

create table public.wedding_profiles (
  id               uuid primary key default extensions.gen_random_uuid(),
  user_id          uuid not null unique references public.profiles (id) on delete cascade,
  display_label    text,
  wedding_date     date,
  flexible_month   char(7) check (flexible_month ~ '^\d{4}-\d{2}$'),
  primary_city_id  uuid references public.cities (id) on delete set null,
  budget_min_minor bigint check (budget_min_minor >= 0),
  budget_max_minor bigint check (budget_max_minor >= 0),
  currency         char(3) not null default 'INR',
  guest_count      integer check (guest_count >= 0),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint wedding_profiles_budget_ordered
    check (budget_min_minor is null or budget_max_minor is null
           or budget_min_minor <= budget_max_minor)
);

create trigger wedding_profiles_updated_at
  before update on public.wedding_profiles
  for each row execute function public.set_updated_at();

create table public.wedding_required_categories (
  wedding_profile_id uuid not null references public.wedding_profiles (id) on delete cascade,
  category_id        uuid not null references public.categories (id) on delete cascade,
  status             text not null default 'searching'
                       check (status in ('searching','shortlisted','booked','skipped')),
  primary key (wedding_profile_id, category_id)
);

create table public.shortlists (
  id         uuid primary key default extensions.gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  note       text,
  compare_flag boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, vendor_id)
);

create index shortlists_user_idx on public.shortlists (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- enquiries
-- ---------------------------------------------------------------------------

create table public.rfq_requests (
  id                uuid primary key default extensions.gen_random_uuid(),
  customer_id       uuid not null references public.profiles (id) on delete cascade,
  category_id       uuid references public.categories (id) on delete set null,
  city_id           uuid references public.cities (id) on delete set null,
  requirements_json jsonb not null default '{}'::jsonb,
  status            text not null default 'open' check (status in ('open','closed')),
  created_at        timestamptz not null default now()
);

create table public.enquiries (
  id                        uuid primary key default extensions.gen_random_uuid(),
  rfq_id                    uuid references public.rfq_requests (id) on delete set null,
  customer_id               uuid not null references public.profiles (id) on delete restrict,
  vendor_id                 uuid not null references public.vendors (id) on delete restrict,
  category_id               uuid references public.categories (id) on delete set null,
  event_date                date,
  flexible_date             char(7) check (flexible_date ~ '^\d{4}-\d{2}$'),
  city_id                   uuid references public.cities (id) on delete set null,
  budget_min_minor          bigint check (budget_min_minor >= 0),
  budget_max_minor          bigint check (budget_max_minor >= 0),
  currency                  char(3) not null default 'INR',
  guest_count               integer check (guest_count >= 0),
  requirements_json         jsonb not null default '{}'::jsonb,
  message                   text,
  preferred_contact_mode    text check (preferred_contact_mode in ('email','phone','whatsapp','in_app')),
  status                    public.enquiry_status not null default 'draft',
  contact_consent           boolean not null default false,
  assigned_vendor_member_id uuid references public.vendor_memberships (id) on delete set null,
  idempotency_key           text,
  delivered_at              timestamptz,
  first_response_at         timestamptz,
  lost_reason               text,
  quote_amount_minor        bigint check (quote_amount_minor >= 0),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger enquiries_updated_at
  before update on public.enquiries
  for each row execute function public.set_updated_at();

create index enquiries_vendor_idx   on public.enquiries (vendor_id, created_at desc);
create index enquiries_customer_idx on public.enquiries (customer_id, created_at desc);
create index enquiries_status_idx   on public.enquiries (status, created_at);
-- Idempotent submission (PRD 10.3, 15).
create unique index enquiries_idempotency_idx
  on public.enquiries (customer_id, idempotency_key) where idempotency_key is not null;

-- Append-only lifecycle log. No update or delete policy exists for this table.
create table public.enquiry_events (
  id            uuid primary key default extensions.gen_random_uuid(),
  enquiry_id    uuid not null references public.enquiries (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_type    public.actor_type not null,
  event_type    text not null,
  from_status   public.enquiry_status,
  to_status     public.enquiry_status,
  reason        text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index enquiry_events_enquiry_idx on public.enquiry_events (enquiry_id, created_at);

create table public.enquiry_notes (
  id             uuid primary key default extensions.gen_random_uuid(),
  enquiry_id     uuid not null references public.enquiries (id) on delete cascade,
  vendor_id      uuid not null references public.vendors (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete set null,
  note           text not null,
  follow_up_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index enquiry_notes_enquiry_idx on public.enquiry_notes (enquiry_id, created_at desc);

-- ---------------------------------------------------------------------------
-- messaging
-- ---------------------------------------------------------------------------

create table public.conversations (
  id         uuid primary key default extensions.gen_random_uuid(),
  enquiry_id uuid not null unique references public.enquiries (id) on delete cascade,
  status     text not null default 'open' check (status in ('open','locked','closed')),
  created_at timestamptz not null default now()
);

create table public.messages (
  id              uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_user_id  uuid not null references public.profiles (id) on delete restrict,
  body            text not null check (length(body) between 1 and 5000),
  status          text not null default 'sent' check (status in ('sent','blocked','deleted')),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.message_attachments (
  id          uuid primary key default extensions.gen_random_uuid(),
  message_id  uuid not null references public.messages (id) on delete cascade,
  storage_path text not null,
  mime_type   text not null,
  size_bytes  bigint not null check (size_bytes > 0),
  scan_status text not null default 'pending'
                check (scan_status in ('pending','clean','infected','skipped')),
  created_at  timestamptz not null default now()
);

/* Thread participation: customer, any active member of the target vendor, or
 * an admin with support permission. */
create or replace function public.can_access_enquiry(target_enquiry uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enquiries e
    where e.id = target_enquiry
      and (
        e.customer_id = (select auth.uid())
        or public.is_vendor_member(e.vendor_id)
        or public.has_admin_permission('lead.read')
      )
  );
$$;

revoke execute on function public.can_access_enquiry(uuid) from public;
grant execute on function public.can_access_enquiry(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

create table public.reviews (
  id                uuid primary key default extensions.gen_random_uuid(),
  enquiry_id        uuid not null references public.enquiries (id) on delete restrict,
  customer_id       uuid not null references public.profiles (id) on delete restrict,
  vendor_id         uuid not null references public.vendors (id) on delete cascade,
  overall_rating    smallint not null check (overall_rating between 1 and 5),
  subratings_json   jsonb not null default '{}'::jsonb,
  title             text,
  body              text,
  event_date        date,
  status            public.moderation_status not null default 'pending',
  moderation_reason text,
  reviewer_id       uuid references public.profiles (id) on delete set null,
  edited_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (enquiry_id, customer_id)
);

create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create index reviews_vendor_idx on public.reviews (vendor_id, status, created_at desc);
create index reviews_queue_idx on public.reviews (status, created_at);

create table public.review_revisions (
  id         uuid primary key default extensions.gen_random_uuid(),
  review_id  uuid not null references public.reviews (id) on delete cascade,
  body       text,
  title      text,
  rating     smallint,
  created_at timestamptz not null default now()
);

create table public.review_media (
  id                uuid primary key default extensions.gen_random_uuid(),
  review_id         uuid not null references public.reviews (id) on delete cascade,
  storage_path      text not null,
  moderation_status public.moderation_status not null default 'pending',
  created_at        timestamptz not null default now()
);

create table public.review_responses (
  id             uuid primary key default extensions.gen_random_uuid(),
  review_id      uuid not null unique references public.reviews (id) on delete cascade,
  vendor_id      uuid not null references public.vendors (id) on delete cascade,
  author_user_id uuid references public.profiles (id) on delete set null,
  body           text not null,
  status         public.moderation_status not null default 'pending',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger review_responses_updated_at
  before update on public.review_responses
  for each row execute function public.set_updated_at();

/* Rating aggregates recompute from APPROVED reviews only (PRD 6.3, 6.8). */
create or replace function public.refresh_vendor_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  -- NEW is unassigned on DELETE, so it must not be referenced there.
  if tg_op = 'DELETE' then
    target := old.vendor_id;
  else
    target := new.vendor_id;
  end if;

  update public.vendors v
  set rating_average = coalesce(agg.avg_rating, 0),
      rating_count   = coalesce(agg.total, 0)
  from (
    select avg(overall_rating)::numeric(3,2) as avg_rating, count(*) as total
    from public.reviews
    where vendor_id = target and status = 'approved'
  ) agg
  where v.id = target;
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update of status, overall_rating or delete on public.reviews
  for each row execute function public.refresh_vendor_rating();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.wedding_profiles            enable row level security;
alter table public.wedding_required_categories enable row level security;
alter table public.shortlists                  enable row level security;
alter table public.rfq_requests                enable row level security;
alter table public.enquiries                   enable row level security;
alter table public.enquiry_events              enable row level security;
alter table public.enquiry_notes               enable row level security;
alter table public.conversations               enable row level security;
alter table public.messages                    enable row level security;
alter table public.message_attachments         enable row level security;
alter table public.reviews                     enable row level security;
alter table public.review_revisions            enable row level security;
alter table public.review_media                enable row level security;
alter table public.review_responses            enable row level security;

create policy "wedding_profiles: own all"
  on public.wedding_profiles for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "wedding_required_categories: own all"
  on public.wedding_required_categories for all to authenticated
  using (exists (select 1 from public.wedding_profiles w
                 where w.id = wedding_profile_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.wedding_profiles w
                      where w.id = wedding_profile_id and w.user_id = (select auth.uid())));

-- Shortlists are private: no vendor or admin read by default (PRD 10.2).
create policy "shortlists: own all"
  on public.shortlists for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "rfq_requests: own all"
  on public.rfq_requests for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create policy "enquiries: participant read"
  on public.enquiries for select to authenticated
  using (
    customer_id = (select auth.uid())
    or public.is_vendor_member(vendor_id)
    or public.has_admin_permission('lead.read')
  );

create policy "enquiries: customer create"
  on public.enquiries for insert to authenticated
  with check (customer_id = (select auth.uid()));

-- Status transitions are validated by a server RPC, not by direct UPDATE. The
-- policy only decides who may attempt a write at all.
create policy "enquiries: participant update"
  on public.enquiries for update to authenticated
  using (
    customer_id = (select auth.uid())
    or public.vendor_can(vendor_id, 'lead.respond')
    or public.has_admin_permission('lead.assign')
  )
  with check (
    customer_id = (select auth.uid())
    or public.vendor_can(vendor_id, 'lead.respond')
    or public.has_admin_permission('lead.assign')
  );

create policy "enquiry_events: participant read"
  on public.enquiry_events for select to authenticated
  using (public.can_access_enquiry(enquiry_id));
create policy "enquiry_events: participant append"
  on public.enquiry_events for insert to authenticated
  with check (public.can_access_enquiry(enquiry_id));

-- Internal notes are never visible to the customer.
create policy "enquiry_notes: vendor read"
  on public.enquiry_notes for select to authenticated
  using (public.is_vendor_member(vendor_id) or public.has_admin_permission('lead.read'));
create policy "enquiry_notes: vendor write"
  on public.enquiry_notes for all to authenticated
  using (public.vendor_can(vendor_id, 'note.manage'))
  with check (public.vendor_can(vendor_id, 'note.manage'));

create policy "conversations: participant read"
  on public.conversations for select to authenticated
  using (public.can_access_enquiry(enquiry_id));

create policy "messages: participant read"
  on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and public.can_access_enquiry(c.enquiry_id)));

create policy "messages: participant send"
  on public.messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and exists (select 1 from public.conversations c
                where c.id = conversation_id
                  and c.status = 'open'
                  and public.can_access_enquiry(c.enquiry_id))
  );

-- Only the read receipt is user-updatable; body edits are not permitted.
create policy "messages: mark read"
  on public.messages for update to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and public.can_access_enquiry(c.enquiry_id)))
  with check (exists (select 1 from public.conversations c
                      where c.id = conversation_id and public.can_access_enquiry(c.enquiry_id)));

create policy "message_attachments: participant read"
  on public.message_attachments for select to authenticated
  using (exists (
    select 1 from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and public.can_access_enquiry(c.enquiry_id)
  ));

create policy "reviews: public read approved"
  on public.reviews for select to anon, authenticated
  using (status = 'approved');
create policy "reviews: own read"
  on public.reviews for select to authenticated
  using (
    customer_id = (select auth.uid())
    or public.is_vendor_member(vendor_id)
    or public.has_admin_permission('review.moderate')
  );
-- Eligibility (an enquiry that actually belongs to this customer and vendor) is
-- enforced here as well as in the service layer.
create policy "reviews: customer create"
  on public.reviews for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.enquiries e
      where e.id = enquiry_id
        and e.customer_id = (select auth.uid())
        and e.vendor_id = reviews.vendor_id
    )
  );
create policy "reviews: customer edit"
  on public.reviews for update to authenticated
  using (customer_id = (select auth.uid()) and status in ('pending','approved'))
  with check (customer_id = (select auth.uid()));
create policy "reviews: admin moderate"
  on public.reviews for update to authenticated
  using (public.has_admin_permission('review.moderate'))
  with check (public.has_admin_permission('review.moderate'));

create policy "review_revisions: own read"
  on public.review_revisions for select to authenticated
  using (exists (select 1 from public.reviews r
                 where r.id = review_id
                   and (r.customer_id = (select auth.uid())
                        or public.has_admin_permission('review.moderate'))));

create policy "review_media: public read approved"
  on public.review_media for select to anon, authenticated
  using (moderation_status = 'approved');
create policy "review_media: owner write"
  on public.review_media for all to authenticated
  using (exists (select 1 from public.reviews r
                 where r.id = review_id and r.customer_id = (select auth.uid())))
  with check (exists (select 1 from public.reviews r
                      where r.id = review_id and r.customer_id = (select auth.uid())));

create policy "review_responses: public read approved"
  on public.review_responses for select to anon, authenticated
  using (status = 'approved');
create policy "review_responses: vendor write"
  on public.review_responses for all to authenticated
  using (public.vendor_can(vendor_id, 'lead.respond'))
  with check (public.vendor_can(vendor_id, 'lead.respond'));
create policy "review_responses: admin moderate"
  on public.review_responses for update to authenticated
  using (public.has_admin_permission('review.moderate'))
  with check (public.has_admin_permission('review.moderate'));
