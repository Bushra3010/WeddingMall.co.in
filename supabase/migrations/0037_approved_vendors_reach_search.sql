-- 0037  Approving a vendor makes them findable.
--
-- Migration 0011 introduced versioned listings and redefined `search_vendors`
-- to require an **approved row in `vendor_listing_versions`**:
--
--     and exists (
--       select 1 from public.vendor_listing_versions vv
--       where vv.vendor_id = v.id and vv.status = 'approved')
--
-- `admin_decide_vendor()` was written in 0008, before versions existed, and was
-- never updated. Its approve branch sets `vendors.status = 'active'`,
-- `vendor_listings.status = 'approved'`, verifies the vendor and refreshes the
-- search text — everything except the one row search actually keys on.
--
-- So a vendor approved from `/admin/vendors` reads "Live" in the admin panel,
-- has an approved listing, is returned by `public_vendors`, is counted on the
-- category tiles — and never appears in search or on the homepage. Nothing in
-- the admin UI could show this, because by every field the admin can see, the
-- vendor is published.
--
-- Found by asking why 7 of 10 active vendors were missing from the homepage
-- rail. The three that were present had reached `approved` through
-- `moderate_listing_version()`, which does write the version row.
--
-- Two parts: teach the approval path to publish a version, and backfill the
-- vendors already stranded by it.

-- ---------------------------------------------------------------------------
-- 1. Approve publishes a version
-- ---------------------------------------------------------------------------
-- Mirrors the approve branch of `moderate_listing_version()`: archive whatever
-- was published, then insert the current snapshot as the approved version.
-- Idempotent by construction — a vendor that already has an approved version
-- gets it archived and replaced by a fresh snapshot, which is what re-approving
-- should mean anyway.
--
-- Otherwise identical to the 0008 definition.

create or replace function public.admin_decide_vendor(
  target_vendor uuid,
  decision      text,
  reason        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v        public.vendors%rowtype;
  actor    uuid := (select auth.uid());
  before   jsonb;
  listing  public.vendor_listings%rowtype;
  next_no  integer;
begin
  if decision not in ('approve', 'request_changes', 'reject', 'suspend', 'reactivate') then
    raise exception 'Unknown decision: %', decision using errcode = 'P0001';
  end if;

  if decision in ('suspend', 'reactivate') then
    if not public.has_admin_permission('vendor.suspend') then
      raise exception 'You do not have permission to suspend businesses.' using errcode = '42501';
    end if;
  elsif not public.has_admin_permission('vendor.verify') then
    raise exception 'You do not have permission to decide verification.' using errcode = '42501';
  end if;

  if decision <> 'approve' and coalesce(trim(reason), '') = '' then
    raise exception 'A reason is required for this decision.' using errcode = 'P0001';
  end if;

  select * into v from public.vendors where id = target_vendor;
  if not found then
    raise exception 'Business not found.' using errcode = 'P0002';
  end if;

  before := jsonb_build_object(
    'status', v.status,
    'verification_status', v.verification_status
  );

  if decision = 'approve' then
    update public.vendors
      set status = 'active',
          verification_status = 'verified',
          published_at = coalesce(published_at, now()),
          rejection_reason = null,
          suspended_reason = null
      where id = target_vendor;

    update public.vendor_listings
      set status = 'approved', published_at = now()
      where vendor_id = target_vendor;

    update public.vendor_verifications
      set status = 'verified', decided_at = now(), reviewer_id = actor, reason = null
      where vendor_id = target_vendor and status = 'pending';

    update public.vendor_media
      set moderation_status = 'approved'
      where vendor_id = target_vendor and moderation_status = 'pending';

    /*
     * The row `search_vendors` keys on. Without this the vendor is published
     * everywhere the admin can see and findable nowhere a couple can look.
     *
     * A listing row is required to snapshot from; a vendor approved before one
     * exists is a data state that should not occur, and silently skipping it
     * would recreate exactly the bug this migration fixes, so it raises.
     */
    select * into listing from public.vendor_listings where vendor_id = target_vendor;
    if listing.id is null then
      raise exception 'This business has no listing to publish.' using errcode = 'P0002';
    end if;

    update public.vendor_listing_versions
      set status = 'archived'
      where vendor_id = target_vendor and status = 'approved';

    select coalesce(max(version_no), 0) + 1 into next_no
      from public.vendor_listing_versions where vendor_id = target_vendor;

    insert into public.vendor_listing_versions
      (listing_id, vendor_id, version_no, snapshot_json, status,
       published_at, decided_at, reviewer_id)
    values
      (listing.id, target_vendor, next_no, public.build_listing_snapshot(target_vendor),
       'approved', now(), now(), actor);

  elsif decision = 'request_changes' then
    update public.vendors
      set status = 'draft', rejection_reason = reason
      where id = target_vendor;
    update public.vendor_listings
      set status = 'draft'
      where vendor_id = target_vendor;
    update public.vendor_verifications
      set reason = admin_decide_vendor.reason, decided_at = now(), reviewer_id = actor
      where vendor_id = target_vendor and status = 'pending';

  elsif decision = 'reject' then
    update public.vendors
      set status = 'rejected', verification_status = 'rejected', rejection_reason = reason
      where id = target_vendor;
    update public.vendor_listings
      set status = 'rejected'
      where vendor_id = target_vendor;
    update public.vendor_verifications
      set status = 'rejected', decided_at = now(), reviewer_id = actor,
          reason = admin_decide_vendor.reason
      where vendor_id = target_vendor and status = 'pending';

  elsif decision = 'suspend' then
    update public.vendors
      set status = 'suspended', suspended_reason = reason
      where id = target_vendor;

  elsif decision = 'reactivate' then
    update public.vendors
      set status = 'active', suspended_reason = null
      where id = target_vendor;
  end if;

  perform public.refresh_vendor_search_text(target_vendor);

  insert into public.audit_logs
    (actor_user_id, actor_type, action, entity_type, entity_id,
     before_json, after_json, reason)
  select actor, 'admin', 'vendor.' || decision, 'vendor', target_vendor,
         before,
         jsonb_build_object('status', nv.status, 'verification_status', nv.verification_status),
         reason
  from public.vendors nv where nv.id = target_vendor;

  return jsonb_build_object('ok', true, 'decision', decision);
end;
$$;

revoke execute on function public.admin_decide_vendor(uuid, text, text) from public;
grant execute on function public.admin_decide_vendor(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Backfill the vendors already stranded
-- ---------------------------------------------------------------------------
-- Every active vendor whose listing is approved but which has no approved
-- version. These were published by an admin and have been invisible to search
-- ever since — the fix above only helps the next approval.
--
-- Guarded by the `not exists`, so re-running this file adds nothing.

insert into public.vendor_listing_versions
  (listing_id, vendor_id, version_no, snapshot_json, status, published_at, decided_at)
select
  l.id,
  v.id,
  coalesce(
    (select max(vv.version_no) from public.vendor_listing_versions vv where vv.vendor_id = v.id),
    0
  ) + 1,
  public.build_listing_snapshot(v.id),
  'approved',
  coalesce(v.published_at, now()),
  now()
from public.vendors v
join public.vendor_listings l on l.vendor_id = v.id and l.status = 'approved'
where v.status = 'active'
  and not exists (
    select 1 from public.vendor_listing_versions vv
    where vv.vendor_id = v.id and vv.status = 'approved'
  );
