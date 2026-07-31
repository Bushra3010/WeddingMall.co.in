-- 0007  Public projections and the search contract.
-- PRD 6.2 (ranking), 6.3, 11.3, 10.1 (public reads expose only approved fields).

-- `security_invoker = true` keeps the caller's RLS in force, so the view is a
-- column filter rather than a privilege escalation.

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
  l.about,
  l.experience_years,
  l.languages,
  l.policies_json,
  l.faqs_json
from public.vendors v
left join public.vendor_listings l
  on l.vendor_id = v.id and l.status = 'approved'
where v.status = 'active';

-- Availability signal only: `note_private` is deliberately not projected.
create view public.public_vendor_availability
with (security_invoker = true)
as
select a.vendor_id, a.start_date, a.end_date, a.status
from public.vendor_availability a
join public.vendors v on v.id = a.vendor_id and v.status = 'active'
where a.status in ('available', 'unavailable');

grant select on public.public_vendors to anon, authenticated;
grant select on public.public_vendor_availability to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Searchable text, maintained by trigger so ranking never scans child tables.
-- ---------------------------------------------------------------------------

alter table public.vendors add column search_text text;
alter table public.vendors
  add column search_tsv tsvector
  generated always as (to_tsvector('simple', coalesce(search_text, ''))) stored;

create index vendors_search_tsv_idx on public.vendors using gin (search_tsv);
create index vendors_search_trgm_idx
  on public.vendors using gin (search_text extensions.gin_trgm_ops);

create or replace function public.refresh_vendor_search_text(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.vendors v
  set search_text = concat_ws(' ',
        v.display_name,
        (select l.about from public.vendor_listings l where l.vendor_id = v.id),
        (select string_agg(c.name, ' ') from public.vendor_categories vc
           join public.categories c on c.id = vc.category_id where vc.vendor_id = v.id),
        (select string_agg(ci.name, ' ') from public.vendor_service_areas sa
           join public.cities ci on ci.id = sa.city_id where sa.vendor_id = v.id),
        (select string_agg(p.name, ' ') from public.vendor_packages p
           where p.vendor_id = v.id and p.active)
      )
  where v.id = target;
$$;

create or replace function public.trg_refresh_vendor_search()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if tg_op = 'DELETE' then
    target := old.vendor_id;
  else
    target := new.vendor_id;
  end if;
  perform public.refresh_vendor_search_text(target);
  return null;
end;
$$;

create trigger vendor_listings_search_refresh
  after insert or update of about on public.vendor_listings
  for each row execute function public.trg_refresh_vendor_search();

create trigger vendor_categories_search_refresh
  after insert or delete on public.vendor_categories
  for each row execute function public.trg_refresh_vendor_search();

create trigger vendor_packages_search_refresh
  after insert or update of name, active or delete on public.vendor_packages
  for each row execute function public.trg_refresh_vendor_search();

-- ---------------------------------------------------------------------------
-- search_vendors
--
-- Stable return contract so an external search adapter (Typesense/Meilisearch)
-- can replace the internals later without touching callers (PRD 11.3).
--
-- filters: {
--   q, categorySlug, citySlug, minRating, verifiedOnly,
--   budgetMinMinor, budgetMaxMinor, sort, limit, offset
-- }
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
    coalesce(filters ->> 'sort', 'recommended')      as sort,
    least(coalesce((filters ->> 'limit')::int, 24), 60) as lim,
    greatest(coalesce((filters ->> 'offset')::int, 0), 0) as off
),
matched as (
  select
    v.id,
    v.slug,
    v.display_name,
    ci.slug as city_slug,
    ci.name as city_name,
    v.rating_average,
    v.rating_count,
    v.verification_status,
    v.is_featured,
    v.created_at,
    v.published_at,
    (select min(p.min_amount_minor) from public.vendor_packages p
      where p.vendor_id = v.id and p.active and p.min_amount_minor is not null)
      as starting_amount_minor,
    coalesce(
      (select p.currency from public.vendor_packages p
        where p.vendor_id = v.id and p.active order by p.sort_order limit 1),
      'INR'::char(3)
    ) as currency,
    (select m.storage_path from public.vendor_media m
      where m.vendor_id = v.id and m.moderation_status = 'approved'
      order by m.is_cover desc, m.sort_order limit 1) as cover_path,
    case
      when p.q is null then 0::numeric
      else greatest(
        ts_rank(v.search_tsv, websearch_to_tsquery('simple', p.q))::numeric,
        extensions.similarity(v.display_name, p.q)::numeric
      )
    end as text_relevance,
    v.listing_quality,
    -- Bayesian shrinkage: a 5.0 from two reviews must not outrank a 4.6
    -- from two hundred (PRD 6.2).
    (v.rating_average / 5.0) * (v.rating_count::numeric / (v.rating_count + 10)) as rating_confidence,
    v.response_score,
    greatest(
      0,
      1 - (extract(epoch from (now() - coalesce(v.published_at, v.created_at)))
           / (180 * 24 * 3600))
    )::numeric as freshness,
    v.plan_boost
  from public.vendors v
  cross join params p
  left join public.cities ci on ci.id = v.primary_city_id
  join public.vendor_listings l on l.vendor_id = v.id and l.status = 'approved'
  where v.status = 'active'
    and v.rating_average >= p.min_rating
    and (not p.verified_only or v.verification_status = 'verified')
    and (
      p.category_slug is null
      or exists (
        select 1 from public.vendor_categories vc
        join public.categories c on c.id = vc.category_id
        where vc.vendor_id = v.id and c.slug = p.category_slug
      )
    )
    and (
      p.city_slug is null
      or ci.slug = p.city_slug
      or exists (
        select 1 from public.vendor_service_areas sa
        join public.cities sc on sc.id = sa.city_id
        where sa.vendor_id = v.id and sc.slug = p.city_slug
      )
    )
    and (
      p.q is null
      or v.search_tsv @@ websearch_to_tsquery('simple', p.q)
      or extensions.similarity(v.display_name, p.q) > 0.2
    )
    and (
      p.budget_max is null
      or exists (
        select 1 from public.vendor_packages pk
        where pk.vendor_id = v.id and pk.active
          and coalesce(pk.min_amount_minor, 0) <= p.budget_max
      )
    )
    and (
      p.budget_min is null
      or exists (
        select 1 from public.vendor_packages pk
        where pk.vendor_id = v.id and pk.active
          and coalesce(pk.max_amount_minor, pk.min_amount_minor, 0) >= p.budget_min
      )
    )
),
scored as (
  select m.*,
    ( 0.30 * m.text_relevance
    + 0.20 * m.listing_quality
    + 0.15 * m.rating_confidence
    + 0.15 * m.response_score
    + 0.10 * m.freshness
    + 0.10 * m.plan_boost )::numeric as rank_score
  from matched m
)
select
  s.id, s.slug, s.display_name, s.city_slug, s.city_name,
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

-- ---------------------------------------------------------------------------
-- Storage buckets (PRD 3, 10.1)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('vendor-media', 'vendor-media', true, 10485760,
   array['image/jpeg','image/png','image/webp','image/avif']),
  ('review-media', 'review-media', true, 5242880,
   array['image/jpeg','image/png','image/webp']),
  ('vendor-documents', 'vendor-documents', false, 10485760,
   array['image/jpeg','image/png','application/pdf']),
  ('message-attachments', 'message-attachments', false, 10485760,
   array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

-- Public buckets are world-readable; writes are still membership-gated. Object
-- paths are `<vendorId>/<filename>`, so the first path segment is the tenant.
create policy "vendor-media: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'vendor-media');

create policy "vendor-media: member write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vendor-media'
    and public.vendor_can(((storage.foldername(name))[1])::uuid, 'media.manage')
  );

create policy "vendor-media: member delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vendor-media'
    and public.vendor_can(((storage.foldername(name))[1])::uuid, 'media.manage')
  );

-- Private bucket: no anon policy at all. Reads happen through short-lived
-- signed URLs issued server-side after a permission check.
create policy "vendor-documents: member read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vendor-documents'
    and (
      public.vendor_can(((storage.foldername(name))[1])::uuid, 'team.manage')
      or public.has_admin_permission('vendor.verify')
    )
  );

create policy "vendor-documents: member write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vendor-documents'
    and public.vendor_can(((storage.foldername(name))[1])::uuid, 'team.manage')
  );

create policy "review-media: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'review-media');

create policy "review-media: own write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'review-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "message-attachments: participant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.can_access_enquiry(((storage.foldername(name))[1])::uuid)
  );

create policy "message-attachments: participant write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and public.can_access_enquiry(((storage.foldername(name))[1])::uuid)
  );
