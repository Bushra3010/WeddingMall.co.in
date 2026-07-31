-- 0009  Fix the "what is still missing" message in submit_vendor_for_review.
--
-- `missing := missing || 'some text'` is ambiguous: Postgres can resolve `||`
-- as anyarray || anyarray and then tries to parse the string literal as an
-- array, failing with 22P02 "Array value must start with {".
--
-- The bug only fired when a field was actually missing, so the happy path
-- passed while the validation path — the one a real vendor hits — returned an
-- opaque 400 instead of the list of what to fix. Use array_append, which is
-- unambiguous.

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

  if v.status = 'pending_review' then
    raise exception 'This business is already awaiting review.' using errcode = 'P0001';
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
