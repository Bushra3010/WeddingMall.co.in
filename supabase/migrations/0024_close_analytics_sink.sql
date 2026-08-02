-- ---------------------------------------------------------------------------
-- 0024 — `analytics_events` was an open sink
--
-- `analytics_events: anyone insert` granted INSERT to anon with no WITH CHECK.
-- Anyone holding the publishable key — which ships in the browser — could
-- write arbitrary rows, including forged `vendor_profile_view` events naming
-- any vendor.
--
-- That is not just table pollution. `rebuild_vendor_metrics()` (0019) counts
-- those events into `vendor_metrics_daily`, which the vendor analytics screen
-- reports and which `analytics` is a plan entitlement for. A competitor could
-- inflate a rival's numbers, or a vendor could inflate their own and argue
-- about the invoice.
--
-- Found during the Milestone 7 review. The first probe reported it blocked:
-- the insert had used `Prefer: return=representation`, and anon has no SELECT
-- here, so a successful write came back as an error. Re-running it and then
-- checking the table with the service role showed the row sitting there. A
-- write path must be verified by looking at the table, never by reading the
-- status code of the write.
--
-- `record_vendor_profile_view()` already existed for exactly this purpose: it
-- pins the event name and entity type and checks the vendor is published. The
-- open policy simply made it optional.
-- ---------------------------------------------------------------------------

drop policy if exists "analytics_events: anyone insert" on public.analytics_events;

-- No client-facing INSERT policy remains, so the table is deny-all for anon
-- and authenticated. Writes arrive only through SECURITY DEFINER functions and
-- the service role, both of which are server-side code.

comment on table public.analytics_events is
  'Append-only event log. Not client-writable: use record_vendor_profile_view() or the service role (0024).';

-- ---------------------------------------------------------------------------
-- Make the remaining path resistant to trivial inflation.
--
-- The function is still callable by anyone — it has to be, or an anonymous
-- visitor could not be counted. But a repeat from the same session within the
-- window is dropped, so inflating a number now costs a distinct session per
-- event rather than a loop. This is deterrence, not proof of humanity; the
-- honest description of the metric remains "page loads by distinct session".
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
declare
  window_minutes constant integer := 30;
begin
  if not exists (
    select 1 from public.vendors v where v.id = p_vendor_id and v.status = 'active'
  ) then
    return;
  end if;

  -- Null sessions cannot be de-duplicated, so they are counted as-is rather
  -- than collapsed together — collapsing would under-count real visitors whose
  -- browser blocked storage.
  if p_session_id is not null and exists (
    select 1
    from public.analytics_events a
    where a.entity_type = 'vendor'
      and a.entity_id = p_vendor_id
      and a.name = 'vendor_profile_view'
      and a.session_id = left(p_session_id, 64)
      and a.occurred_at > now() - make_interval(mins => window_minutes)
  ) then
    return;
  end if;

  insert into public.analytics_events (name, entity_type, entity_id, session_id, user_id)
  values ('vendor_profile_view', 'vendor', p_vendor_id, left(p_session_id, 64), (select auth.uid()));
end;
$$;

create index if not exists analytics_events_session_idx
  on public.analytics_events (entity_id, session_id, occurred_at desc)
  where entity_type = 'vendor';
