-- 0035  Registration reaches the review queue, and a business can be deleted.
--
-- Three problems found by reading the live data rather than the code:
--
--   * 18 vendors, 9 active and 9 draft, and **zero** in `pending_review`. Every
--     registration since 2026-08-02 has been sitting in `draft`, which is not
--     the tab an admin lands on and not the queue anyone watches. The newest of
--     them — city set, one category, one service area, a 2,108-character
--     description — satisfies every gate in `submit_vendor_for_review()` and is
--     still `draft` with `submitted_at = null`. The vendor filled in everything
--     and never pressed the last button, and no admin could move them on.
--
--   * `public.vendors` has no DELETE policy. Not a restrictive one — none at
--     all, across 0001–0034. A delete therefore matches zero rows, PostgREST
--     answers 200 with an empty body, and the caller cannot tell "refused" from
--     "done". That is why there has never been a delete button.
--
--   * Two of the fifteen foreign keys into `vendors` are `on delete restrict`
--     (`enquiries`, `payments`) and the rest cascade — including `reviews`,
--     `vendor_media`, and `vendor_packages`. A delete wired straight to
--     `DELETE FROM` would either surface a raw 23503 or silently take a
--     customer's reviews with it.

-- ---------------------------------------------------------------------------
-- 1. A registration may enter the review queue directly
-- ---------------------------------------------------------------------------
-- `vendors: create own` (0004) pinned inserts to `status = 'draft'`, so the
-- registration form had no way to produce a row an admin would see. Widened to
-- the two statuses a self-service signup can legitimately claim.
--
-- `pending_review` is still not public — `vendors: public read active` needs
-- `active` — and the 0022 column guard still refuses any *update* to `status`
-- from a non-moderator. The only thing this grants is the right to arrive in
-- the queue, which is the point.

drop policy if exists "vendors: create own" on public.vendors;
create policy "vendors: create own"
  on public.vendors for insert to authenticated
  with check (
    (select auth.uid()) = owner_user_id
    and status in ('draft', 'pending_review')
  );

-- ---------------------------------------------------------------------------
-- 2. A business already awaiting review may re-submit
-- ---------------------------------------------------------------------------
-- Consequence of the change above: a vendor now registers *into* the queue and
-- then finishes their listing. Under the old guard the "Submit for review"
-- button at the end of the wizard raised "This business is already awaiting
-- review." — the one action left to them, refused.
--
-- Re-submitting is harmless. `submitted_at` is refreshed, which sorts them to
-- the *back* of the oldest-first queue rather than the front, so there is
-- nothing to game. The verification record is reused, exactly as before, so
-- duplicates still cannot stack up.
--
-- Otherwise identical to the 0009 definition.

create or replace function public.submit_vendor_for_review(target_vendor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v            public.vendors%rowtype;
  listing      public.vendor_listings%rowtype;
  category_ct  integer;
  area_ct      integer;
  missing      text[] := array[]::text[];
  actor        uuid := (select auth.uid());
begin
  if not public.vendor_can(target_vendor, 'listing.submit') then
    raise exception 'You do not have permission to submit this business for review.'
      using errcode = '42501';
  end if;

  select * into v from public.vendors where id = target_vendor;
  if not found then
    raise exception 'Business not found.' using errcode = 'P0002';
  end if;

  if v.status = 'suspended' then
    raise exception 'A suspended business cannot be submitted for review.' using errcode = 'P0001';
  end if;

  select * into listing from public.vendor_listings where vendor_id = target_vendor;
  select count(*) into category_ct from public.vendor_categories where vendor_id = target_vendor;
  select count(*) into area_ct from public.vendor_service_areas where vendor_id = target_vendor;

  if coalesce(trim(v.display_name), '') = '' then
    missing := array_append(missing, 'business name');
  end if;
  if v.primary_city_id is null then
    missing := array_append(missing, 'primary city');
  end if;
  if category_ct = 0 then
    missing := array_append(missing, 'at least one category');
  end if;
  if area_ct = 0 then
    missing := array_append(missing, 'at least one service area');
  end if;
  if listing.id is null or length(coalesce(listing.about, '')) < 50 then
    missing := array_append(missing, 'an "about" description of at least 50 characters');
  end if;

  if array_length(missing, 1) > 0 then
    raise exception 'Still needed before review: %', array_to_string(missing, ', ')
      using errcode = 'P0001';
  end if;

  update public.vendors
    set status = 'pending_review',
        submitted_at = now(),
        rejection_reason = null
    where id = target_vendor;

  update public.vendor_listings
    set status = 'pending', submitted_at = now()
    where vendor_id = target_vendor;

  if not exists (
    select 1 from public.vendor_verifications
    where vendor_id = target_vendor and status = 'pending'
  ) then
    insert into public.vendor_verifications (vendor_id, type, status, submitted_at)
    values (target_vendor, 'business_registration', 'pending', now());
  else
    update public.vendor_verifications
      set submitted_at = now()
      where vendor_id = target_vendor and status = 'pending';
  end if;

  insert into public.audit_logs
    (actor_user_id, actor_type, action, entity_type, entity_id, before_json, after_json)
  values
    (actor, 'vendor', 'vendor.submitted_for_review', 'vendor', target_vendor,
     jsonb_build_object('status', v.status),
     jsonb_build_object('status', 'pending_review'));

  return jsonb_build_object('ok', true, 'status', 'pending_review');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Deleting a business
-- ---------------------------------------------------------------------------
-- Same shape as `delete_city()` (0032) and `delete_category()` (0034), for the
-- same reason. `for update` conflicts with the `for key share` an FK insert
-- takes, so nothing can attach an enquiry between the count and the delete.
--
-- The refusal points at Suspend rather than just saying no. A business with
-- customer history is one an admin almost always wants *hidden*, not erased —
-- suspension already removes it from search, the homepage, and its public
-- profile, and leaves the enquiries and reviews attached to it readable.
--
-- SECURITY INVOKER: the policy below decides who may delete. This function adds
-- a reason, never a privilege.

create or replace function public.delete_vendor(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name    text;
  v_enq     integer;
  v_pay     integer;
  v_reviews integer;
  v_subs    integer;
begin
  select display_name into v_name from public.vendors where id = p_id for update;
  if v_name is null then
    raise exception 'That business no longer exists.' using errcode = 'PT404';
  end if;

  select count(*) into v_enq     from public.enquiries     where vendor_id = p_id;
  select count(*) into v_pay     from public.payments      where vendor_id = p_id;
  select count(*) into v_reviews from public.reviews       where vendor_id = p_id;
  select count(*) into v_subs    from public.subscriptions where vendor_id = p_id;

  if v_enq + v_pay + v_reviews + v_subs > 0 then
    raise exception '% has customer history (%). Suspend it instead — that removes it from search and its public profile while keeping the record intact.',
      v_name,
      array_to_string(array_remove(array[
        case when v_enq     > 0 then v_enq     || case when v_enq = 1 then ' enquiry' else ' enquiries' end end,
        case when v_pay     > 0 then v_pay     || ' payment'      || case when v_pay     = 1 then '' else 's' end end,
        case when v_reviews > 0 then v_reviews || ' review'       || case when v_reviews = 1 then '' else 's' end end,
        case when v_subs    > 0 then v_subs    || ' subscription' || case when v_subs    = 1 then '' else 's' end end
      ], null), ', ')
      using errcode = 'PT409';
  end if;

  -- Everything that survives the counts above cascades: memberships, the
  -- listing and its versions, categories, service areas, addresses,
  -- verifications and their documents, attribute values, media, packages,
  -- availability, metrics, and shortlist entries.
  delete from public.vendors where id = p_id;
  if not found then
    raise exception 'You do not have permission to delete that business.' using errcode = 'PT403';
  end if;

  delete from public.slug_redirects where entity_type = 'vendor' and entity_id = p_id;
end;
$$;

comment on function public.delete_vendor(uuid) is
  'Deletes a business that has no customer history. Refuses with PT409 otherwise, naming what is in the way.';

revoke execute on function public.delete_vendor(uuid) from public;
grant execute on function public.delete_vendor(uuid) to authenticated;

-- The privilege itself. `admin.manage` is super-admin only: removing a business
-- outright is not something a vendor verifier or a support agent should be able
-- to do by misclicking, and suspension — which they do hold — covers every
-- routine case.
--
-- Dropped first so this file can be re-run. `scripts/apply-migrations.mjs`
-- replays every migration in order rather than tracking what has been applied,
-- so anything that is not idempotent is a one-shot.
drop policy if exists "vendors: admin delete" on public.vendors;
create policy "vendors: admin delete"
  on public.vendors for delete to authenticated
  using (public.has_admin_permission('admin.manage'));

-- ---------------------------------------------------------------------------
-- 4. Storage objects left behind
-- ---------------------------------------------------------------------------
-- `vendor_documents` rows cascade, but the private files they point at live in
-- storage and do not. Deleting them here would need the storage schema's own
-- policies to line up with this transaction; instead the orphan is left for the
-- existing media cleanup job, which already reconciles storage against the
-- table. Noted rather than silently ignored.
