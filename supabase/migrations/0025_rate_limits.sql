-- ---------------------------------------------------------------------------
-- 0025 — Rate limiting (PRD 10.3)
--
-- Serverless functions do not share memory and are recycled constantly, so an
-- in-process token bucket would reset on every cold start and hold different
-- counts per instance. The limiter has to live where the state already is.
--
-- One row per (bucket, subject, window). `consume_rate_limit` increments
-- atomically via ON CONFLICT and returns whether the caller is still under the
-- ceiling, so two concurrent requests cannot both read "9 of 10" and both
-- proceed — the increment and the check are one statement.
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limits (
  bucket       text        not null,
  subject      text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, subject, window_start)
);

comment on table public.rate_limits is
  'Fixed-window counters. Not client-readable: knowing your remaining quota helps only an abuser.';

alter table public.rate_limits enable row level security;
-- No policies: deny-all for anon and authenticated. Every caller goes through
-- `consume_rate_limit`, which is SECURITY DEFINER.

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

-- ---------------------------------------------------------------------------

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_subject text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket_start timestamptz;
  current_count integer;
begin
  if p_subject is null or p_subject = '' then
    -- No subject means we cannot attribute the request. Fail closed: an
    -- unattributable caller is exactly the one worth limiting.
    return false;
  end if;

  -- Fixed windows rather than sliding: a sliding window needs per-request
  -- timestamps and a range scan, and the extra precision buys nothing when the
  -- purpose is stopping floods rather than metering billing.
  bucket_start := to_timestamp(
    floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1)
  );

  insert into public.rate_limits (bucket, subject, window_start, count)
  values (p_bucket, p_subject, bucket_start, 1)
  on conflict (bucket, subject, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into current_count;

  return current_count <= p_limit;
end;
$$;

comment on function public.consume_rate_limit(text, text, integer, integer) is
  'Increments and tests in one statement. True when the caller is still within the limit.';

grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Housekeeping. Called by the existing metrics cron so the table does not grow
-- without bound; a missed run costs disk, never correctness.
-- ---------------------------------------------------------------------------

create or replace function public.prune_rate_limits(p_older_than_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.rate_limits
  where window_start < now() - make_interval(hours => greatest(p_older_than_hours, 1));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

grant execute on function public.prune_rate_limits(integer) to service_role;
