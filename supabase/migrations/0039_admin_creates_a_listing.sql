-- 0039  An admin can create a business, and publish it in the same step.
--
-- Until now every business in the marketplace arrived the same way: somebody
-- signed up, filled the wizard, and waited to be approved. That is the right
-- default and it is not the only case. Businesses are signed up over the phone,
-- at wedding fairs, and by a salesperson sitting next to the owner — and in all
-- three the person with the details in front of them is an admin, not the
-- vendor. The admin panel could approve, edit, suspend and delete a business;
-- it could not create one.
--
-- ## Why this needs a function at all
--
-- Four separate things block a plain insert from the admin panel:
--
--   * `vendors: create own` (0004, widened in 0035) requires
--     `auth.uid() = owner_user_id`, so an admin cannot insert a row owned by
--     the vendor.
--   * `vendors.status` may only be `draft` or `pending_review` on insert, and
--     the 0022 column guard refuses an *update* to `status` — so "create it
--     live" is not reachable in two steps either.
--   * A published business needs five rows written together — the vendor, the
--     owner membership, the listing, a category, a service area — plus an
--     approved row in `vendor_listing_versions`, which is what search actually
--     keys on. 0037 exists because that last one was missed once already.
--   * `vendors.owner_user_id` is `not null`. Somebody has to own it.
--
-- ## Publishing without verifying
--
-- `p_publish` sets `status = 'active'` and publishes the listing, so the
-- business is live immediately — no queue, no second click. It deliberately
-- leaves `verification_status = 'unverified'`.
--
-- Live and verified are different claims. "Live" means we are showing this
-- business; "Verified" means somebody looked at its registration documents,
-- and on this site it renders as a badge next to the name. An admin creating a
-- listing from a phone call has done the first and not the second, and a badge
-- that means "an admin was in a hurry" is worse than no badge — it devalues it
-- everywhere else it appears. The verified state is still reachable the normal
-- way: upload the documents, then Approve.
--
-- ## Ownership
--
-- If `p_owner_email` names an existing account, that account owns the business
-- and gets the `vendor_owner` membership — they sign in and find their listing
-- already there. If it is blank, the **creating admin** owns it and holds the
-- membership, so the listing is editable through the normal vendor screens
-- until it is handed over. An unknown email is refused rather than silently
-- falling back: "I typed their email and it went to me instead" is a bug report
-- nobody enjoys.

create or replace function public.admin_create_vendor(
  p_display_name       text,
  p_slug               text,
  p_primary_category   uuid,
  p_primary_city       uuid,
  p_about              text default null,
  p_email              text default null,
  p_phone              text default null,
  p_website            text default null,
  p_owner_email        text default null,
  p_publish            boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor        uuid := (select auth.uid());
  owner_id     uuid;
  new_vendor   uuid;
  listing_id   uuid;
  clean_slug   text := lower(trim(coalesce(p_slug, '')));
  clean_about  text := nullif(trim(coalesce(p_about, '')), '');
  vendor_state public.vendor_status;
  listing_state public.moderation_status;
begin
  -- Creating a live listing is a moderation act, so it takes the moderation
  -- permission. `vendor.read` would let an analyst publish.
  if not public.has_admin_permission('vendor.verify') then
    raise exception 'You do not have permission to create a business.' using errcode = '42501';
  end if;

  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Enter the business name.' using errcode = 'P0001';
  end if;
  if clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(clean_slug) < 3 then
    raise exception 'The web address must be lowercase letters, numbers and hyphens.'
      using errcode = 'P0001';
  end if;
  if p_primary_category is null or p_primary_city is null then
    raise exception 'Choose a category and a city.' using errcode = 'P0001';
  end if;

  -- The same floor `submit_vendor_for_review()` applies. Publishing a listing
  -- with an empty description puts a blank profile in front of couples, and the
  -- admin is the only person who can still fix it before it is live.
  if p_publish and (clean_about is null or length(clean_about) < 50) then
    raise exception 'A listing going live needs a description of at least 50 characters.'
      using errcode = 'P0001';
  end if;

  -- Who owns it.
  if coalesce(trim(p_owner_email), '') <> '' then
    select u.id into owner_id
    from auth.users u
    where lower(u.email) = lower(trim(p_owner_email))
    limit 1;

    if owner_id is null then
      raise exception 'No account exists for %. Ask them to sign up first, or leave the owner blank and you will hold the listing.',
        trim(p_owner_email)
        using errcode = 'P0002';
    end if;

    -- `vendors.owner_user_id` points at `profiles`, not at `auth.users`. The
    -- profile is written by a trigger on sign-up, so a missing one means a
    -- broken account rather than a missing person — worth saying so.
    if not exists (select 1 from public.profiles where id = owner_id) then
      raise exception 'That account has no profile yet and cannot own a listing.'
        using errcode = 'P0001';
    end if;
  else
    owner_id := actor;
  end if;

  if owner_id is null then
    raise exception 'Sign in again — your session could not be identified.' using errcode = '42501';
  end if;

  if exists (select 1 from public.vendors where slug = clean_slug) then
    raise exception 'The web address "%" is already used by another business.', clean_slug
      using errcode = 'PT409';
  end if;

  vendor_state  := case when p_publish then 'active' else 'draft' end;
  listing_state := case when p_publish then 'approved' else 'draft' end;

  insert into public.vendors (
    display_name, slug, owner_user_id, status, verification_status,
    primary_city_id, email, phone, website, published_at, submitted_at
  ) values (
    trim(p_display_name), clean_slug, owner_id, vendor_state, 'unverified',
    p_primary_city,
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_website, '')), ''),
    case when p_publish then now() end,
    now()
  )
  returning id into new_vendor;

  insert into public.vendor_memberships (vendor_id, user_id, role, status)
  values (new_vendor, owner_id, 'vendor_owner', 'active');

  insert into public.vendor_listings (vendor_id, status, about, published_at, submitted_at)
  values (new_vendor, listing_state, clean_about,
          case when p_publish then now() end, now())
  returning id into listing_id;

  insert into public.vendor_categories (vendor_id, category_id, is_primary)
  values (new_vendor, p_primary_category, true);

  -- A business almost always serves the city it is based in; the vendor or the
  -- admin can widen this afterwards. Without at least one row the listing fails
  -- the submit gate and is invisible to the city filter.
  insert into public.vendor_service_areas (vendor_id, city_id, travel_available)
  values (new_vendor, p_primary_city, false)
  on conflict do nothing;

  if p_publish then
    -- The row search keys on. `admin_decide_vendor()` did not write one until
    -- 0037, and seven live vendors were missing from the homepage as a result;
    -- a new path that skips approval must not reintroduce that.
    insert into public.vendor_listing_versions
      (listing_id, vendor_id, version_no, snapshot_json, status, published_at, decided_at, reviewer_id)
    values
      (listing_id, new_vendor, 1, public.build_listing_snapshot(new_vendor),
       'approved', now(), now(), actor);

    perform public.refresh_vendor_search_text(new_vendor);
  end if;

  insert into public.audit_logs
    (actor_user_id, actor_type, action, entity_type, entity_id, before_json, after_json)
  values
    (actor, 'admin', 'vendor.admin_created', 'vendor', new_vendor, null,
     jsonb_build_object(
       'status', vendor_state,
       'slug', clean_slug,
       'published', p_publish,
       'owner_user_id', owner_id,
       'owner_is_creator', owner_id = actor
     ));

  return jsonb_build_object(
    'ok', true,
    'vendorId', new_vendor,
    'slug', clean_slug,
    'status', vendor_state,
    'ownerIsCreator', owner_id = actor
  );
end;
$$;

comment on function public.admin_create_vendor(text, text, uuid, uuid, text, text, text, text, text, boolean) is
  'Creates a business on an admin''s behalf, optionally publishing it immediately. Live but never verified — the badge still requires documents and an Approve.';

revoke execute on function public.admin_create_vendor(text, text, uuid, uuid, text, text, text, text, text, boolean) from public;
grant execute on function public.admin_create_vendor(text, text, uuid, uuid, text, text, text, text, text, boolean) to authenticated;
