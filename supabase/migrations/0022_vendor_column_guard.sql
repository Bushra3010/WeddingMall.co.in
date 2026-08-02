-- ---------------------------------------------------------------------------
-- 0022 — Commercial and trust columns are not the vendor's to write
--
-- `vendors: member update` grants UPDATE to any member holding `listing.edit`.
-- RLS is row-level, so that grant covers every column of the row. Probed
-- against the live database, a vendor owner could PATCH:
--
--   * `is_featured  = true`            — paid placement, top of search, free;
--   * `verification_status = verified` — the trust badge the marketplace sells;
--   * `status = active`                — self-publish, skipping moderation;
--   * `plan_id`                        — self-upgrade to any plan.
--
-- Each was confirmed by writing a value the row did not already hold, so
-- "HTTP 200" could not be mistaken for a no-op.
--
-- Same shape as ADR-019 and ADR-031, now on the table that decides who gets
-- seen and who looks trustworthy.
--
-- ## Why this trigger is SECURITY INVOKER
--
-- The legitimate writers are `submit_vendor_for_review()`, `admin_decide_vendor()`
-- and `refresh_vendor_rating()` — all SECURITY DEFINER, so inside them
-- `current_user` is the function owner rather than `authenticated`. Running the
-- guard as INVOKER lets it see that difference and step aside, instead of
-- needing every one of those functions re-declared to set a flag.
-- ---------------------------------------------------------------------------

create or replace function public.can_moderate_vendors()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_admin_permission('vendor.verify')
    or public.has_admin_permission('vendor.suspend')
    or public.has_admin_permission('billing.manage')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

grant execute on function public.can_moderate_vendors() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Featured placement must be backed by a plan that grants it.
-- ---------------------------------------------------------------------------

create or replace function public.vendor_may_be_featured(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select (p.entitlements_json ->> 'featured')::boolean
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      where s.vendor_id = p_vendor_id
        and s.status in ('trialing', 'active')
      order by s.created_at desc
      limit 1
    ),
    false
  )
$$;

comment on function public.vendor_may_be_featured(uuid) is
  'True when the vendor holds a live subscription whose plan grants featured placement.';

grant execute on function public.vendor_may_be_featured(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The guard
-- ---------------------------------------------------------------------------

create or replace function public.enforce_vendor_column_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  -- `authenticated` and `anon` are the roles PostgREST connects as. Anything
  -- else is either the service role or a SECURITY DEFINER function running as
  -- its owner, both of which are server-side code that has already made its
  -- own checks.
  from_client boolean := current_user in ('authenticated', 'anon');
  is_moderator boolean := public.can_moderate_vendors();
begin
  if not from_client then
    return new;
  end if;

  if not is_moderator then
    if new.status is distinct from old.status
       or new.verification_status is distinct from old.verification_status
       or new.plan_id is distinct from old.plan_id
       or new.is_featured is distinct from old.is_featured
       or new.published_at is distinct from old.published_at
       or new.rejection_reason is distinct from old.rejection_reason
       or new.suspended_reason is distinct from old.suspended_reason then
      raise exception
        'Publication, verification, plan, and placement are set by review, not by the vendor'
        using errcode = '42501';
    end if;

    -- Ratings are derived from approved reviews and recomputed by trigger.
    -- A vendor writing them directly would be inventing a reputation.
    if new.rating_average is distinct from old.rating_average
       or new.rating_count is distinct from old.rating_count then
      raise exception 'Ratings are computed from approved reviews' using errcode = '42501';
    end if;
  end if;

  -- Applies to moderators too. "Sponsored" has to mean somebody is paying;
  -- comping placement is done by changing the plan, which leaves a record,
  -- rather than by flipping a boolean that leaves none.
  if new.is_featured and not old.is_featured
     and not public.vendor_may_be_featured(new.id) then
    raise exception 'Featured placement requires a plan that includes it'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists vendors_column_guard on public.vendors;
create trigger vendors_column_guard
  before update on public.vendors
  for each row execute function public.enforce_vendor_column_guard();
