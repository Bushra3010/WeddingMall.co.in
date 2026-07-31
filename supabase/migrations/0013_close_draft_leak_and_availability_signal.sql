-- 0013  Close a draft-content leak, and make the public availability signal work.
--
-- Both found by scripts/rls-listing-probe.mjs.

-- ---------------------------------------------------------------------------
-- 1. LEAK: `vendor_listings` was still publicly readable.
--
-- Its policy allows anon to read rows with status = 'approved', and
-- `admin_decide_vendor` / `moderate_listing_version` set exactly that on the
-- DRAFT row when a version is published. So after any publication, anon could
-- query vendor_listings directly and read the vendor's unreviewed working copy
-- — the very content migration 0011 was written to keep private.
--
-- Since 0011 the public surface reads `vendor_listing_versions` (approved
-- snapshots only) and never touches this table, so public read can simply go.
-- ---------------------------------------------------------------------------

drop policy if exists "vendor_listings: public read published" on public.vendor_listings;

-- ---------------------------------------------------------------------------
-- 2. The public availability signal returned nothing.
--
-- `public_vendor_availability` was declared security_invoker, and
-- `vendor_availability` has no anon policy — deliberately, because the row
-- carries `note_private`. So the view was correct in what it projected and
-- useless in practice.
--
-- RLS is row-level, so granting anon read on the table would expose the private
-- note. The view is the column filter: recreate it WITHOUT security_invoker so
-- it runs with definer rights and projects only the safe columns.
--
-- This is a deliberate, reviewed RLS bypass — the same reasoning as
-- `search_vendors` (ADR-006). It must never gain a column that is not safe for
-- an anonymous visitor, and `note_private` must never appear here.
-- ---------------------------------------------------------------------------

drop view if exists public.public_vendor_availability;

create view public.public_vendor_availability
with (security_invoker = false)
as
select
  a.vendor_id,
  a.start_date,
  a.end_date,
  a.status
from public.vendor_availability a
join public.vendors v on v.id = a.vendor_id and v.status = 'active'
where a.status in ('available', 'unavailable');

grant select on public.public_vendor_availability to anon, authenticated;

comment on view public.public_vendor_availability is
  'Public availability signal. SECURITY DEFINER by design: vendor_availability '
  'carries note_private, which must never be exposed. Do not add columns here '
  'without re-reviewing against PRD 10.1.';
