-- 0008  Vendor onboarding, membership bootstrap, and admin moderation.
-- PRD 6.4, 6.9, 6.11, 10, Epic D/E.
--
-- Three policy gaps in 0004 made onboarding impossible; they are fixed here.
-- Each is covered by a probe in scripts/rls-tenant-probe.mjs.

-- ---------------------------------------------------------------------------
-- 1. An owner could not read back the vendor they had just created.
--    The only SELECT policies were "active vendors" (a draft is not active)
--    and "is a member" (no membership exists yet), so the insert succeeded but
--    the row was invisible to its own creator.
-- ---------------------------------------------------------------------------

create policy "vendors: owner read"
  on public.vendors for select to authenticated
  using (owner_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Membership bootstrap deadlock. `vendor_memberships: manage` requires
--    vendor_can(vendor_id, 'team.manage'), which reads vendor_memberships —
--    so the first owner membership could never be created.
--
--    This policy is deliberately narrow: only the vendor's own owner_user_id,
--    only the vendor_owner role. The unique (vendor_id, user_id) constraint
--    stops it being replayed. It does not reference vendor_memberships, so
--    there is no policy recursion.
-- ---------------------------------------------------------------------------

create policy "vendor_memberships: owner bootstrap"
  on public.vendor_memberships for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'vendor_owner'
    and status = 'active'
    and exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.owner_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Admins could not act. `vendors` and `vendor_listings` had UPDATE policies
--    for members only, so approve/reject/suspend/moderate were impossible.
--
--    Writes still go through the RPCs below in normal operation; these
--    policies exist so an admin tool or support query is not locked out.
-- ---------------------------------------------------------------------------

create policy "vendors: admin moderate"
  on public.vendors for update to authenticated
  using (
    public.has_admin_permission('vendor.verify')
    or public.has_admin_permission('vendor.suspend')
  )
  with check (
    public.has_admin_permission('vendor.verify')
    or public.has_admin_permission('vendor.suspend')
  );

create policy "vendor_listings: admin moderate"
  on public.vendor_listings for update to authenticated
  using (public.has_admin_permission('listing.moderate'))
  with check (public.has_admin_permission('listing.moderate'));

-- A member must be able to remove a document uploaded in error before
-- submitting for review.
create policy "vendor_documents: member delete"
  on public.vendor_documents for delete to authenticated
  using (exists (
    select 1 from public.vendor_verifications v
    where v.id = verification_id and public.vendor_can(v.vendor_id, 'team.manage')
  ));

-- ---------------------------------------------------------------------------
-- 4. Taxonomy management was gated on `admin.manage`, which only super_admin
--    holds — yet PRD 4.3 makes maintaining categories and locations an
--    operations/content job. Widen to include cms.publish.
-- ---------------------------------------------------------------------------

create or replace function public.can_manage_taxonomy()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_admin_permission('admin.manage')
      or public.has_admin_permission('cms.publish');
$$;

revoke execute on function public.can_manage_taxonomy() from public;
grant execute on function public.can_manage_taxonomy() to authenticated;

drop policy if exists "categories: admin write" on public.categories;
create policy "categories: taxonomy write"
  on public.categories for all to authenticated
  using (public.can_manage_taxonomy())
  with check (public.can_manage_taxonomy());

drop policy if exists "category_attributes: admin write" on public.category_attributes;
create policy "category_attributes: taxonomy write"
  on public.category_attributes for all to authenticated
  using (public.can_manage_taxonomy())
  with check (public.can_manage_taxonomy());

drop policy if exists "cities: admin write" on public.cities;
create policy "cities: taxonomy write"
  on public.cities for all to authenticated
  using (public.can_manage_taxonomy())
  with check (public.can_manage_taxonomy());

drop policy if exists "states: admin write" on public.states;
create policy "states: taxonomy write"
  on public.states for all to authenticated
  using (public.can_manage_taxonomy())
  with check (public.can_manage_taxonomy());

drop policy if exists "areas: admin write" on public.areas;
create policy "areas: taxonomy write"
  on public.areas for all to authenticated
  using (public.can_manage_taxonomy())
  with check (public.can_manage_taxonomy());

-- Admins need to see inactive taxonomy rows while editing them.
create policy "categories: taxonomy read all"
  on public.categories for select to authenticated
  using (public.can_manage_taxonomy());
create policy "cities: taxonomy read all"
  on public.cities for select to authenticated
  using (public.can_manage_taxonomy());

-- ---------------------------------------------------------------------------
-- 5. Onboarding columns
-- ---------------------------------------------------------------------------

alter table public.vendors add column if not exists submitted_at timestamptz;
alter table public.vendors add column if not exists rejection_reason text;

create index if not exists vendors_review_queue_idx
  on public.vendors (status, submitted_at) where status = 'pending_review';

-- ---------------------------------------------------------------------------
-- 6. submit_vendor_for_review
--
-- SECURITY DEFINER so it can write audit_logs (which has no user-facing insert
-- policy). It re-checks the caller's capability itself — being SECURITY DEFINER
-- does not exempt it from authorisation, it just moves the check into the body.
-- ---------------------------------------------------------------------------

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
  missing      text[] := '{}';
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

  if v.status = 'pending_review' then
    raise exception 'This business is already awaiting review.' using errcode = 'P0001';
  end if;
  if v.status = 'suspended' then
    raise exception 'A suspended business cannot be submitted for review.' using errcode = 'P0001';
  end if;

  select * into listing from public.vendor_listings where vendor_id = target_vendor;
  select count(*) into category_ct from public.vendor_categories where vendor_id = target_vendor;
  select count(*) into area_ct from public.vendor_service_areas where vendor_id = target_vendor;

  -- Structural gate. The richer weighted completion score lives in
  -- src/features/vendors/completion.ts and drives the UI; this is the
  -- server-side minimum that cannot be bypassed.
  if coalesce(trim(v.display_name), '') = '' then
    missing := missing || 'business name';
  end if;
  if v.primary_city_id is null then
    missing := missing || 'primary city';
  end if;
  if category_ct = 0 then
    missing := missing || 'at least one category';
  end if;
  if area_ct = 0 then
    missing := missing || 'at least one service area';
  end if;
  if listing.id is null or length(coalesce(listing.about, '')) < 50 then
    missing := missing || 'an "about" description of at least 50 characters';
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

  -- Reuse an open verification record rather than stacking duplicates.
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

revoke execute on function public.submit_vendor_for_review(uuid) from public;
grant execute on function public.submit_vendor_for_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. admin_decide_vendor
--
-- One atomic transition covering every admin decision, so publication state,
-- verification state, the search index, and the audit entry cannot drift apart
-- (PRD 6.11, Epic E: every moderation action requires a reason where specified).
-- ---------------------------------------------------------------------------

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
  v      public.vendors%rowtype;
  actor  uuid := (select auth.uid());
  before jsonb;
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

  -- Every decision except approval must carry a reason the vendor can act on.
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

    -- Approved media becomes publicly visible with the listing.
    update public.vendor_media
      set moderation_status = 'approved'
      where vendor_id = target_vendor and moderation_status = 'pending';

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

  -- Search text is maintained by triggers on child tables, which do not fire
  -- on a status change. Refresh explicitly or an approved vendor stays
  -- unsearchable (see CLAUDE.md gotchas).
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
-- 8. Team invitations
--
-- Enforces the role ceiling in the database, mirroring canGrantVendorRole() in
-- src/lib/permissions/catalogue.ts: a manager must not be able to mint an owner.
-- ---------------------------------------------------------------------------

create or replace function public.invite_vendor_member(
  target_vendor uuid,
  invitee_email text,
  member_role   public.vendor_role
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.vendor_role := public.vendor_role_of(target_vendor);
  invitee    uuid;
  actor      uuid := (select auth.uid());
begin
  if not public.vendor_can(target_vendor, 'team.manage') then
    raise exception 'You do not have permission to manage this team.' using errcode = '42501';
  end if;

  -- Role ceiling: only an owner may create another owner.
  if member_role = 'vendor_owner' and actor_role <> 'vendor_owner' then
    raise exception 'Only the owner can grant owner access.' using errcode = '42501';
  end if;

  select id into invitee from auth.users where lower(email) = lower(invitee_email);

  if invitee is null then
    raise exception 'No account exists for %. Ask them to sign up first.', invitee_email
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.vendor_memberships
    where vendor_id = target_vendor and user_id = invitee and status <> 'revoked'
  ) then
    raise exception 'That person is already on the team.' using errcode = 'P0001';
  end if;

  insert into public.vendor_memberships (vendor_id, user_id, role, status, invited_by, invited_email)
  values (target_vendor, invitee, member_role, 'invited', actor, invitee_email);

  insert into public.audit_logs
    (actor_user_id, actor_type, action, entity_type, entity_id, after_json)
  values
    (actor, 'vendor', 'vendor.member_invited', 'vendor', target_vendor,
     jsonb_build_object('user_id', invitee, 'role', member_role));

  return jsonb_build_object('ok', true, 'user_id', invitee);
end;
$$;

revoke execute on function public.invite_vendor_member(uuid, text, public.vendor_role) from public;
grant execute on function public.invite_vendor_member(uuid, text, public.vendor_role) to authenticated;
