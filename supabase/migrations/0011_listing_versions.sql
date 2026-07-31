-- 0011  Versioned listings: the public page reads an approved snapshot.
--
-- Before this, `public_vendors` read `vendor_listings` directly, so any edit a
-- vendor made to an approved listing went live immediately with no
-- re-moderation. `vendor_listing_versions` existed but was never written to.
-- PRD 6.9 requires the opposite: "preserve currently published version until
-- update approval".
--
-- Model after this migration:
--   vendor_listings          — the working DRAFT. `status` tracks the review
--                              state of the latest submission.
--   vendor_listing_versions  — immutable snapshots. The newest `approved` row
--                              is what the public sees.

-- ---------------------------------------------------------------------------
-- 1. Denormalise vendor_id onto versions.
--
-- The public view must not have to join `vendor_listings` to reach a version:
-- that table's public policy requires status = 'approved', so a vendor with a
-- pending edit would make their own published page disappear.
-- ---------------------------------------------------------------------------

alter table public.vendor_listing_versions
  add column if not exists vendor_id uuid references public.vendors (id) on delete cascade;

alter table public.vendor_listing_versions
  add column if not exists published_at timestamptz;

update public.vendor_listing_versions vv
set vendor_id = l.vendor_id
from public.vendor_listings l
where l.id = vv.listing_id and vv.vendor_id is null;

alter table public.vendor_listing_versions alter column vendor_id set not null;

create index if not exists vendor_listing_versions_published_idx
  on public.vendor_listing_versions (vendor_id, version_no desc) where status = 'approved';

-- ---------------------------------------------------------------------------
-- 2. Snapshot builder
-- ---------------------------------------------------------------------------

create or replace function public.build_listing_snapshot(target_vendor uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'about', l.about,
    'experience_years', l.experience_years,
    'languages', to_jsonb(coalesce(l.languages, '{}'::text[])),
    'policies_json', coalesce(l.policies_json, '{}'::jsonb),
    'faqs_json', coalesce(l.faqs_json, '[]'::jsonb),
    'snapshot_at', to_jsonb(now())
  )
  from public.vendor_listings l
  where l.vendor_id = target_vendor;
$$;

-- ---------------------------------------------------------------------------
-- 3. Submit the current draft for review
-- ---------------------------------------------------------------------------

create or replace function public.submit_listing_for_review(target_vendor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing  public.vendor_listings%rowtype;
  next_no  integer;
  snapshot jsonb;
  actor    uuid := (select auth.uid());
  new_id   uuid;
begin
  if not public.vendor_can(target_vendor, 'listing.submit') then
    raise exception 'You do not have permission to submit this listing.' using errcode = '42501';
  end if;

  select * into listing from public.vendor_listings where vendor_id = target_vendor;
  if not found then
    raise exception 'This business has no listing yet.' using errcode = 'P0002';
  end if;

  if length(coalesce(listing.about, '')) < 50 then
    raise exception 'Write at least 50 characters in the description before submitting.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.vendor_listing_versions
    where vendor_id = target_vendor and status = 'pending'
  ) then
    raise exception 'An edit is already awaiting review.' using errcode = 'P0001';
  end if;

  snapshot := public.build_listing_snapshot(target_vendor);

  select coalesce(max(version_no), 0) + 1 into next_no
  from public.vendor_listing_versions where vendor_id = target_vendor;

  insert into public.vendor_listing_versions
    (listing_id, vendor_id, version_no, snapshot_json, status)
  values (listing.id, target_vendor, next_no, snapshot, 'pending')
  returning id into new_id;

  update public.vendor_listings set status = 'pending', submitted_at = now()
  where vendor_id = target_vendor;

  insert into public.audit_logs
    (actor_user_id, actor_type, action, entity_type, entity_id, after_json)
  values (actor, 'vendor', 'listing.submitted', 'vendor', target_vendor,
          jsonb_build_object('version_no', next_no));

  return jsonb_build_object('ok', true, 'version_id', new_id, 'version_no', next_no);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Moderate a pending version
--
-- Approving archives the previously published version rather than deleting it,
-- so the publication history stays intact (PRD 6.9).
-- ---------------------------------------------------------------------------

create or replace function public.moderate_listing_version(
  target_version uuid,
  decision       text,
  reason         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  version public.vendor_listing_versions%rowtype;
  actor   uuid := (select auth.uid());
begin
  if not public.has_admin_permission('listing.moderate') then
    raise exception 'You do not have permission to moderate listings.' using errcode = '42501';
  end if;

  if decision not in ('approve', 'request_changes', 'reject') then
    raise exception 'Unknown decision: %', decision using errcode = 'P0001';
  end if;

  if decision <> 'approve' and coalesce(trim(reason), '') = '' then
    raise exception 'A reason is required for this decision.' using errcode = 'P0001';
  end if;

  select * into version from public.vendor_listing_versions where id = target_version;
  if not found then
    raise exception 'That listing version was not found.' using errcode = 'P0002';
  end if;
  if version.status <> 'pending' then
    raise exception 'That version has already been decided.' using errcode = 'P0001';
  end if;

  if decision = 'approve' then
    -- Retire the version that was published until now.
    update public.vendor_listing_versions
      set status = 'archived'
      where vendor_id = version.vendor_id and status = 'approved';

    update public.vendor_listing_versions
      set status = 'approved', published_at = now(), decided_at = now(), reviewer_id = actor,
          reason = null
      where id = target_version;

    update public.vendor_listings
      set status = 'approved', published_at = now()
      where vendor_id = version.vendor_id;

    update public.vendor_media
      set moderation_status = 'approved'
      where vendor_id = version.vendor_id and moderation_status = 'pending';
  else
    update public.vendor_listing_versions
      set status = 'rejected', decided_at = now(), reviewer_id = actor,
          reason = moderate_listing_version.reason
      where id = target_version;

    -- The draft returns to the vendor; anything already published stays up.
    update public.vendor_listings
      set status = 'draft'
      where vendor_id = version.vendor_id;
  end if;

  perform public.refresh_vendor_search_text(version.vendor_id);

  insert into public.audit_logs
    (actor_user_id, actor_type, action, entity_type, entity_id, after_json, reason)
  values (actor, 'admin', 'listing.' || decision, 'vendor', version.vendor_id,
          jsonb_build_object('version_no', version.version_no), reason);

  return jsonb_build_object('ok', true, 'decision', decision);
end;
$$;

revoke execute on function public.build_listing_snapshot(uuid) from public;
revoke execute on function public.submit_listing_for_review(uuid) from public;
revoke execute on function public.moderate_listing_version(uuid, text, text) from public;
grant execute on function public.submit_listing_for_review(uuid) to authenticated;
grant execute on function public.moderate_listing_version(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Backfill: every currently-published listing becomes version 1.
--    Without this, approving the new view would unpublish every live vendor.
-- ---------------------------------------------------------------------------

insert into public.vendor_listing_versions
  (listing_id, vendor_id, version_no, snapshot_json, status, published_at, decided_at)
select l.id, l.vendor_id, 1, public.build_listing_snapshot(l.vendor_id), 'approved',
       coalesce(l.published_at, now()), now()
from public.vendor_listings l
join public.vendors v on v.id = l.vendor_id
where l.status = 'approved'
  and not exists (
    select 1 from public.vendor_listing_versions vv where vv.vendor_id = l.vendor_id
  );

-- ---------------------------------------------------------------------------
-- 6. Vendor-level approval must also publish the pending listing version.
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
  v        public.vendors%rowtype;
  actor    uuid := (select auth.uid());
  before   jsonb;
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

  before := jsonb_build_object('status', v.status, 'verification_status', v.verification_status);

  if decision = 'approve' then
    update public.vendors
      set status = 'active', verification_status = 'verified',
          published_at = coalesce(published_at, now()),
          rejection_reason = null, suspended_reason = null
      where id = target_vendor;

    update public.vendor_listings
      set status = 'approved', published_at = now()
      where vendor_id = target_vendor;

    -- Publish whatever is pending; if nothing is, snapshot the draft so the
    -- vendor has a published version at all.
    if exists (
      select 1 from public.vendor_listing_versions
      where vendor_id = target_vendor and status = 'pending'
    ) then
      update public.vendor_listing_versions
        set status = 'archived'
        where vendor_id = target_vendor and status = 'approved';
      update public.vendor_listing_versions
        set status = 'approved', published_at = now(), decided_at = now(), reviewer_id = actor
        where vendor_id = target_vendor and status = 'pending';
    elsif not exists (
      select 1 from public.vendor_listing_versions
      where vendor_id = target_vendor and status = 'approved'
    ) then
      select coalesce(max(version_no), 0) + 1 into next_no
      from public.vendor_listing_versions where vendor_id = target_vendor;

      insert into public.vendor_listing_versions
        (listing_id, vendor_id, version_no, snapshot_json, status, published_at, decided_at, reviewer_id)
      select l.id, target_vendor, next_no, public.build_listing_snapshot(target_vendor),
             'approved', now(), now(), actor
      from public.vendor_listings l where l.vendor_id = target_vendor;
    end if;

    update public.vendor_media
      set moderation_status = 'approved'
      where vendor_id = target_vendor and moderation_status = 'pending';

  elsif decision = 'request_changes' then
    update public.vendors set status = 'draft', rejection_reason = reason where id = target_vendor;
    update public.vendor_listings set status = 'draft' where vendor_id = target_vendor;
    update public.vendor_listing_versions
      set status = 'rejected', decided_at = now(), reviewer_id = actor,
          reason = admin_decide_vendor.reason
      where vendor_id = target_vendor and status = 'pending';
    update public.vendor_verifications
      set reason = admin_decide_vendor.reason, decided_at = now(), reviewer_id = actor
      where vendor_id = target_vendor and status = 'pending';

  elsif decision = 'reject' then
    update public.vendors
      set status = 'rejected', verification_status = 'rejected', rejection_reason = reason
      where id = target_vendor;
    update public.vendor_listings set status = 'rejected' where vendor_id = target_vendor;
    update public.vendor_listing_versions
      set status = 'rejected', decided_at = now(), reviewer_id = actor,
          reason = admin_decide_vendor.reason
      where vendor_id = target_vendor and status = 'pending';
    update public.vendor_verifications
      set status = 'rejected', decided_at = now(), reviewer_id = actor,
          reason = admin_decide_vendor.reason
      where vendor_id = target_vendor and status = 'pending';

  elsif decision = 'suspend' then
    update public.vendors set status = 'suspended', suspended_reason = reason
    where id = target_vendor;

  elsif decision = 'reactivate' then
    update public.vendors set status = 'active', suspended_reason = null
    where id = target_vendor;
  end if;

  if decision = 'approve' then
    update public.vendor_verifications
      set status = 'verified', decided_at = now(), reviewer_id = actor, reason = null
      where vendor_id = target_vendor and status = 'pending';
  end if;

  perform public.refresh_vendor_search_text(target_vendor);

  insert into public.audit_logs
    (actor_user_id, actor_type, action, entity_type, entity_id, before_json, after_json, reason)
  select actor, 'admin', 'vendor.' || decision, 'vendor', target_vendor, before,
         jsonb_build_object('status', nv.status, 'verification_status', nv.verification_status),
         reason
  from public.vendors nv where nv.id = target_vendor;

  return jsonb_build_object('ok', true, 'decision', decision);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Search text now reflects the PUBLISHED snapshot, not the draft.
--    Otherwise an unreviewed edit would still be findable through search.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_vendor_search_text(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.vendors v
  set search_text = concat_ws(' ',
        v.display_name,
        (select vv.snapshot_json ->> 'about'
           from public.vendor_listing_versions vv
          where vv.vendor_id = v.id and vv.status = 'approved'
          order by vv.version_no desc limit 1),
        (select string_agg(c.name, ' ') from public.vendor_categories vc
           join public.categories c on c.id = vc.category_id where vc.vendor_id = v.id),
        (select string_agg(ci.name, ' ') from public.vendor_service_areas sa
           join public.cities ci on ci.id = sa.city_id where sa.vendor_id = v.id),
        (select string_agg(p.name, ' ') from public.vendor_packages p
           where p.vendor_id = v.id and p.active)
      )
  where v.id = target;
$$;

-- ---------------------------------------------------------------------------
-- 8. Public view reads the newest approved snapshot.
-- ---------------------------------------------------------------------------

drop view if exists public.public_vendors;

create view public.public_vendors
with (security_invoker = true)
as
select
  v.id,
  v.display_name,
  v.slug,
  v.primary_city_id,
  v.website,
  v.founded_year,
  v.verification_status,
  v.rating_average,
  v.rating_count,
  v.is_featured,
  v.published_at,
  ver.snapshot_json ->> 'about'                         as about,
  (ver.snapshot_json ->> 'experience_years')::integer   as experience_years,
  coalesce(
    array(select jsonb_array_elements_text(ver.snapshot_json -> 'languages')),
    '{}'::text[]
  )                                                     as languages,
  coalesce(ver.snapshot_json -> 'policies_json', '{}'::jsonb) as policies_json,
  coalesce(ver.snapshot_json -> 'faqs_json', '[]'::jsonb)     as faqs_json,
  ver.version_no                                        as published_version_no
from public.vendors v
left join lateral (
  select vv.snapshot_json, vv.version_no
  from public.vendor_listing_versions vv
  where vv.vendor_id = v.id and vv.status = 'approved'
  order by vv.version_no desc
  limit 1
) ver on true
where v.status = 'active';

grant select on public.public_vendors to anon, authenticated;

-- The view is security_invoker, so anon needs to be able to read approved
-- versions of active vendors directly.
create policy "vendor_listing_versions: public read approved"
  on public.vendor_listing_versions for select to anon, authenticated
  using (
    status = 'approved'
    and exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'active')
  );

create policy "vendor_listing_versions: member insert"
  on public.vendor_listing_versions for insert to authenticated
  with check (public.vendor_can(vendor_id, 'listing.edit'));

-- ---------------------------------------------------------------------------
-- 9. Search must only surface vendors with a published version.
-- ---------------------------------------------------------------------------

create or replace function public.search_vendors(filters jsonb default '{}'::jsonb)
returns table (
  vendor_id      uuid,
  slug           text,
  display_name   text,
  city_slug      text,
  city_name      text,
  rating_average numeric,
  rating_count   integer,
  verification_status public.verification_status,
  is_featured    boolean,
  starting_amount_minor bigint,
  currency       char(3),
  cover_path     text,
  rank_score     numeric,
  total_count    bigint
)
language sql
stable
security definer
set search_path = ''
as $$
with params as (
  select
    nullif(trim(filters ->> 'q'), '')                as q,
    nullif(filters ->> 'categorySlug', '')           as category_slug,
    nullif(filters ->> 'citySlug', '')               as city_slug,
    coalesce((filters ->> 'minRating')::numeric, 0)  as min_rating,
    coalesce((filters ->> 'verifiedOnly')::boolean, false) as verified_only,
    (filters ->> 'budgetMinMinor')::bigint           as budget_min,
    (filters ->> 'budgetMaxMinor')::bigint           as budget_max,
    coalesce(filters -> 'attributes', '{}'::jsonb)   as attributes,
    coalesce(filters ->> 'sort', 'recommended')      as sort,
    least(coalesce((filters ->> 'limit')::int, 24), 60) as lim,
    greatest(coalesce((filters ->> 'offset')::int, 0), 0) as off
),
matched as (
  select
    v.id, v.slug, v.display_name,
    ci.slug as city_slug, ci.name as city_name,
    v.rating_average, v.rating_count, v.verification_status, v.is_featured,
    v.created_at, v.published_at,
    (select min(p.min_amount_minor) from public.vendor_packages p
      where p.vendor_id = v.id and p.active and p.min_amount_minor is not null)
      as starting_amount_minor,
    coalesce((select p.currency from public.vendor_packages p
      where p.vendor_id = v.id and p.active order by p.sort_order limit 1),
      'INR'::char(3)) as currency,
    (select m.storage_path from public.vendor_media m
      where m.vendor_id = v.id and m.moderation_status = 'approved'
      order by m.is_cover desc, m.sort_order limit 1) as cover_path,
    case when p.q is null then 0::numeric
         else greatest(
           ts_rank(v.search_tsv, websearch_to_tsquery('simple', p.q))::numeric,
           extensions.similarity(v.display_name, p.q)::numeric)
    end as text_relevance,
    v.listing_quality,
    (v.rating_average / 5.0) * (v.rating_count::numeric / (v.rating_count + 10))
      as rating_confidence,
    v.response_score,
    greatest(0, 1 - (extract(epoch from (now() - coalesce(v.published_at, v.created_at)))
      / (180 * 24 * 3600)))::numeric as freshness,
    v.plan_boost
  from public.vendors v
  cross join params p
  left join public.cities ci on ci.id = v.primary_city_id
  where v.status = 'active'
    -- A published snapshot is what makes a vendor discoverable, not a draft.
    and exists (
      select 1 from public.vendor_listing_versions vv
      where vv.vendor_id = v.id and vv.status = 'approved'
    )
    and v.rating_average >= p.min_rating
    and (not p.verified_only or v.verification_status = 'verified')
    and (p.category_slug is null or exists (
      select 1 from public.vendor_categories vc
      join public.categories c on c.id = vc.category_id
      where vc.vendor_id = v.id and c.slug = p.category_slug))
    and (p.city_slug is null or ci.slug = p.city_slug or exists (
      select 1 from public.vendor_service_areas sa
      join public.cities sc on sc.id = sa.city_id
      where sa.vendor_id = v.id and sc.slug = p.city_slug))
    and (p.q is null
      or v.search_tsv @@ websearch_to_tsquery('simple', p.q)
      or extensions.similarity(v.display_name, p.q) > 0.2)
    and (p.budget_max is null or exists (
      select 1 from public.vendor_packages pk
      where pk.vendor_id = v.id and pk.active
        and coalesce(pk.min_amount_minor, 0) <= p.budget_max))
    and (p.budget_min is null or exists (
      select 1 from public.vendor_packages pk
      where pk.vendor_id = v.id and pk.active
        and coalesce(pk.max_amount_minor, pk.min_amount_minor, 0) >= p.budget_min))
    -- Category-specific attribute filters (PRD 6.2). `attributes` maps an
    -- attribute code to an array of accepted values; every listed code must
    -- match, and within a code any one value is enough.
    and (
      p.attributes = '{}'::jsonb
      or not exists (
        select 1
        from jsonb_each(p.attributes) as f(code, wanted)
        where not exists (
          select 1
          from public.vendor_attribute_values av
          join public.category_attributes ca on ca.id = av.category_attribute_id
          where av.vendor_id = v.id
            and ca.code = f.code
            and (
              av.value_json <@ f.wanted
              or f.wanted @> av.value_json
              or (jsonb_typeof(av.value_json) = 'array'
                  and av.value_json ?| array(select jsonb_array_elements_text(f.wanted)))
              or av.value_json #>> '{}' in (select jsonb_array_elements_text(f.wanted))
            )
        )
      )
    )
),
scored as (
  select m.*,
    ( 0.30 * m.text_relevance + 0.20 * m.listing_quality + 0.15 * m.rating_confidence
    + 0.15 * m.response_score + 0.10 * m.freshness + 0.10 * m.plan_boost )::numeric
      as rank_score
  from matched m
)
select s.id, s.slug, s.display_name, s.city_slug, s.city_name,
  s.rating_average, s.rating_count, s.verification_status, s.is_featured,
  s.starting_amount_minor, s.currency, s.cover_path, s.rank_score,
  count(*) over () as total_count
from scored s
cross join params p
order by
  case when p.sort = 'rating'        then s.rating_average end desc nulls last,
  case when p.sort = 'most_reviewed' then s.rating_count end desc nulls last,
  case when p.sort = 'price_asc'     then s.starting_amount_minor end asc nulls last,
  case when p.sort = 'price_desc'    then s.starting_amount_minor end desc nulls last,
  case when p.sort = 'newest'        then coalesce(s.published_at, s.created_at) end desc nulls last,
  case when p.sort = 'recommended'   then s.rank_score end desc nulls last,
  s.id
limit (select lim from params)
offset (select off from params);
$$;

revoke execute on function public.search_vendors(jsonb) from public;
grant execute on function public.search_vendors(jsonb) to anon, authenticated;

-- Refresh every vendor so search_text reflects published snapshots.
do $$
declare r record;
begin
  for r in select id from public.vendors loop
    perform public.refresh_vendor_search_text(r.id);
  end loop;
end;
$$;
