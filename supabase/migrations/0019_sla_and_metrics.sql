-- ---------------------------------------------------------------------------
-- 0019 — Response SLA and vendor metrics (PRD 6.6, 6.9, 13, Milestone 5)
--
-- `first_response_at` has been recorded since 0015, but nothing read it and
-- nothing wrote `vendor_metrics_daily` — the table has existed empty since
-- 0004. This adds the threshold, the aggregation, and the one missing input.
--
-- Every figure here is derived from operational tables, so the analytics
-- screen counts real activity rather than displaying a plausible number
-- (PRD 6.1 acceptance applies to the vendor dashboard too).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. SLA threshold
-- ---------------------------------------------------------------------------

create table if not exists public.sla_policy (
  id                    boolean primary key default true check (id),
  first_response_hours  integer not null default 24 check (first_response_hours > 0)
);

comment on table public.sla_policy is
  'Singleton. Hours a vendor has to answer a delivered enquiry (PRD 6.6).';

insert into public.sla_policy (id) values (true) on conflict do nothing;

alter table public.sla_policy enable row level security;

drop policy if exists "sla_policy: read" on public.sla_policy;
create policy "sla_policy: read"
  on public.sla_policy for select to anon, authenticated using (true);

drop policy if exists "sla_policy: admin write" on public.sla_policy;
create policy "sla_policy: admin write"
  on public.sla_policy for all to authenticated
  using (public.has_admin_permission('settings.manage'))
  with check (public.has_admin_permission('settings.manage'));

-- ---------------------------------------------------------------------------
-- 2. Which enquiries are overdue
--
-- `security_invoker` so the caller's RLS on `enquiries` decides what they see:
-- a vendor member gets their own overdue leads and nobody else's, with no
-- second copy of that rule living here.
-- ---------------------------------------------------------------------------

create or replace view public.enquiry_sla
with (security_invoker = true)
as
select
  e.id                as enquiry_id,
  e.vendor_id,
  e.delivered_at,
  e.first_response_at,
  p.first_response_hours,
  -- Null until delivered: the clock starts at delivery, not submission.
  case
    when e.delivered_at is null then null
    else extract(epoch from coalesce(e.first_response_at, now()) - e.delivered_at) / 3600.0
  end::numeric(10, 2) as hours_to_first_response,
  (
    e.delivered_at is not null
    and e.first_response_at is null
    and e.status not in ('booked', 'not_booked', 'closed', 'spam')
    and now() > e.delivered_at + make_interval(hours => p.first_response_hours)
  )                   as is_overdue
from public.enquiries e
cross join public.sla_policy p
where p.id;

grant select on public.enquiry_sla to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Profile views
--
-- The one metric with no operational source. `analytics_events` has existed
-- since 0006 but nothing wrote to it. This is SECURITY DEFINER because an
-- anonymous visitor must be able to register a view without being granted
-- INSERT on an analytics table they could then write anything into — the
-- function pins both the event name and the entity type.
-- ---------------------------------------------------------------------------

create or replace function public.record_vendor_profile_view(
  p_vendor_id uuid,
  p_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only counts vendors the public can actually see, so the function cannot be
  -- used to probe for the existence of unpublished ones.
  if not exists (
    select 1 from public.vendors v where v.id = p_vendor_id and v.status = 'active'
  ) then
    return;
  end if;

  insert into public.analytics_events (name, entity_type, entity_id, session_id, user_id)
  values ('vendor_profile_view', 'vendor', p_vendor_id, left(p_session_id, 64), (select auth.uid()));
end;
$$;

grant execute on function public.record_vendor_profile_view(uuid, text) to anon, authenticated;

create index if not exists analytics_events_entity_idx
  on public.analytics_events (entity_type, entity_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 4. Daily rollup
--
-- Recomputes rather than increments, so re-running a day is safe and a missed
-- cron run repairs itself on the next pass. Cron handlers use the service
-- role, so this stays SECURITY INVOKER.
-- ---------------------------------------------------------------------------

create or replace function public.rebuild_vendor_metrics(
  p_from date default (current_date - 1),
  p_to   date default current_date
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  touched integer;
begin
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  ),
  grid as (
    select v.id as vendor_id, d.day
    from public.vendors v cross join days d
    where v.status = 'active'
  ),
  rolled as (
    select
      g.vendor_id,
      g.day,
      (select count(*) from public.analytics_events a
        where a.entity_type = 'vendor' and a.entity_id = g.vendor_id
          and a.name = 'vendor_profile_view'
          and a.occurred_at >= g.day and a.occurred_at < g.day + 1) as profile_views,
      (select count(*) from public.shortlists s
        where s.vendor_id = g.vendor_id
          and s.created_at >= g.day and s.created_at < g.day + 1) as shortlist_adds,
      -- Counted at delivery, not creation: a draft the customer never sent is
      -- not a lead the vendor received.
      (select count(*) from public.enquiries e
        where e.vendor_id = g.vendor_id
          and e.delivered_at >= g.day and e.delivered_at < g.day + 1) as enquiries,
      (select count(*) from public.messages m
        join public.conversations c on c.id = m.conversation_id
        join public.enquiries e on e.id = c.enquiry_id
        where e.vendor_id = g.vendor_id
          and m.created_at >= g.day and m.created_at < g.day + 1) as messages,
      (select count(*) from public.enquiry_events ev
        join public.enquiries e on e.id = ev.enquiry_id
        where e.vendor_id = g.vendor_id and ev.to_status = 'booked'
          and ev.created_at >= g.day and ev.created_at < g.day + 1) as booked_count
    from grid g
  )
  insert into public.vendor_metrics_daily
    (vendor_id, date, profile_views, shortlist_adds, enquiries, messages, booked_count)
  select vendor_id, day, profile_views, shortlist_adds, enquiries, messages, booked_count
  from rolled
  on conflict (vendor_id, date) do update
    set profile_views  = excluded.profile_views,
        shortlist_adds = excluded.shortlist_adds,
        enquiries      = excluded.enquiries,
        messages       = excluded.messages,
        booked_count   = excluded.booked_count;

  get diagnostics touched = row_count;
  return touched;
end;
$$;

comment on function public.rebuild_vendor_metrics(date, date) is
  'Recomputes vendor_metrics_daily for a date range. Idempotent by design.';
