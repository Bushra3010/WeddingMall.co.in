-- ---------------------------------------------------------------------------
-- 0017 — Homepage aggregates
--
-- The homepage was issuing seven queries to render two components, two of them
-- unbounded:
--
--   * `getHomeStats` selected `rating_average, rating_count` for EVERY public
--     vendor and computed the weighted mean in JavaScript. Linear in the size
--     of the catalogue, and the row data was thrown away after summing.
--   * `getCategoryTiles` selected every row of `vendor_categories` with nested
--     `vendor_media`, then counted and picked cover images in JavaScript.
--
--   * Four of the counts went through `public_vendors`, whose lateral join to
--     `vendor_listing_versions` reconstructs a snapshot per row — work that a
--     `count(*)` has no use for.
--
-- Both are replaced with one round trip each, aggregated where the data lives.
--
-- Both functions are SECURITY INVOKER: every table they touch already grants
-- anon a read (`vendors: public read active`, `vendor_media: public read
-- approved`, and the taxonomy tables), so RLS stays the boundary and this
-- migration adds no new privilege surface. `search_path` is pinned per the
-- project convention.
-- ---------------------------------------------------------------------------

create or replace function public.homepage_stats()
returns table (
  vendors_total bigint,
  vendors_verified bigint,
  cities_total bigint,
  categories_total bigint,
  rating_average numeric,
  rating_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.vendors where status = 'active'),
    (select count(*) from public.vendors
      where status = 'active' and verification_status = 'verified'),
    (select count(*) from public.cities where active),
    (select count(*) from public.categories where active),
    -- Weighted by review count, so a single 5.0 cannot outrank the field.
    -- `nullif` guards the division; `coalesce` keeps the column non-null.
    coalesce((
      select sum(v.rating_average * v.rating_count) / nullif(sum(v.rating_count), 0)
      from public.vendors v
      where v.status = 'active' and v.rating_count > 0
    ), 0)::numeric,
    coalesce((
      select sum(v.rating_count) from public.vendors v where v.status = 'active'
    ), 0)::bigint
$$;

comment on function public.homepage_stats() is
  'Live homepage counters in one round trip. Aggregates only — no row data leaves.';

grant execute on function public.homepage_stats() to anon, authenticated;

-- ---------------------------------------------------------------------------

create or replace function public.category_tiles(p_limit integer default 12)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  vendor_count bigint,
  image_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.slug,
    c.description,
    (
      select count(*)
      from public.vendor_categories vc
      join public.vendors v on v.id = vc.vendor_id
      where vc.category_id = c.id and v.status = 'active'
    ) as vendor_count,
    (
      -- A vendor that lists this as its primary category is a better
      -- illustration than one that merely also serves it; `is_cover` then
      -- picks the image the vendor chose, and `id` makes the tie deterministic
      -- so the tile does not change picture between requests.
      select vm.storage_path
      from public.vendor_categories vc
      join public.vendors v on v.id = vc.vendor_id
      join public.vendor_media vm on vm.vendor_id = v.id
      where vc.category_id = c.id
        and v.status = 'active'
        and vm.moderation_status = 'approved'
      order by vc.is_primary desc, vm.is_cover desc, vm.sort_order, vm.id
      limit 1
    ) as image_path
  from public.categories c
  where c.active and c.parent_id is null
  order by c.sort_order
  limit greatest(p_limit, 0)
$$;

comment on function public.category_tiles(integer) is
  'Category tiles with a live vendor count and one approved cover image each.';

grant execute on function public.category_tiles(integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Supporting indexes. Without these the per-category subqueries above are
-- sequential scans once the catalogue is real.
-- ---------------------------------------------------------------------------

create index if not exists vendor_categories_category_id_idx
  on public.vendor_categories (category_id);

create index if not exists vendors_status_idx
  on public.vendors (status) where status = 'active';

create index if not exists vendor_media_vendor_approved_idx
  on public.vendor_media (vendor_id) where moderation_status = 'approved';
