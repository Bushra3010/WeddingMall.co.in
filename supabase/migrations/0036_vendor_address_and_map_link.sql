-- 0036  A street address and a map link for a business.
--
-- `vendor_addresses` has existed since 0004 with `line1`, `line2`,
-- `postal_code`, `latitude`, `longitude` and `public_visibility`, and nothing
-- in `src/` has ever read or written it — the table was defined and then never
-- wired up. It is empty in production (0 rows, checked). So this adds the one
-- column it lacks rather than putting an address on `vendors`, which would make
-- a third place that answers "where is this business".
--
-- Two changes, both idempotent so the file can be replayed.

-- ---------------------------------------------------------------------------
-- 1. The map link
-- ---------------------------------------------------------------------------
-- Stored as the link the vendor pastes, not parsed into `latitude`/`longitude`.
-- Those columns exist and it is tempting, but Google Maps URLs arrive in at
-- least three shapes — `maps.app.goo.gl` short links, `/place/` URLs, and
-- `@lat,lng,zoom` — and the short ones only resolve by following a redirect.
-- Guessing coordinates from a string that may not contain any would put wrong
-- pins on a map, which is worse than no pin. If coordinates are wanted later,
-- resolve them in a job and fill the columns that are already there.

alter table public.vendor_addresses
  add column if not exists maps_url text;

comment on column public.vendor_addresses.maps_url is
  'Link to the business on a map, as pasted by the vendor. Not parsed into latitude/longitude.';

-- Only that it is a URL. Deliberately not restricted to google.com: Apple Maps,
-- OpenStreetMap and a plain share link are all legitimate, and a vendor whose
-- correct link is rejected has no way to comply.
alter table public.vendor_addresses
  drop constraint if exists vendor_addresses_maps_url_check;

alter table public.vendor_addresses
  add constraint vendor_addresses_maps_url_check
  check (maps_url is null or maps_url ~* '^https?://[^[:space:]]+$');

-- ---------------------------------------------------------------------------
-- 2. One address of each type per business
-- ---------------------------------------------------------------------------
-- The table has no unique constraint, so a vendor saving their details twice
-- would accumulate a second 'business' row and reads would start returning
-- whichever one Postgres felt like. An upsert needs something to conflict on;
-- this is it.
--
-- Safe to add: the table is empty, so there is nothing to deduplicate first.

create unique index if not exists vendor_addresses_vendor_type_idx
  on public.vendor_addresses (vendor_id, type);
