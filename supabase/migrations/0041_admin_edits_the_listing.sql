-- 0041  An admin can edit a business's listing, not just its registration.
--
-- `/admin/vendors/new` takes a name, a category, a city and a description, and
-- then there is nowhere to add a photograph — the one thing couples actually
-- look at first. Everything else the vendor wizard collects (service areas,
-- packages, the street address, availability) is in the same position: an admin
-- signing a business up over the phone could create it and could not finish it.
--
-- ## Reads were missing too, which is a bug in its own right
--
-- Most of these tables are readable by `anon` for an **active** vendor and
-- otherwise by members only. A business created by an admin starts as a draft,
-- so `/admin/vendors/<id>` was rendering an em dash next to Categories and
-- Service areas for exactly the businesses an admin is most likely to be
-- looking at. `for all` below fixes reading and writing in one policy.
--
-- ## One permission: listing.moderate
--
-- The permission that already decides who may approve a listing version, and
-- which `vendor_listings: member read` and `vendor_media: member read` already
-- use. Held by `super_admin`, `operations_admin` and `vendor_verifier` only —
-- `content_admin`, `support_agent`, `finance_admin` and `analyst` get nothing
-- here.
--
-- Worth writing down because a service leans on it: all three of those roles
-- also hold `vendor.verify`, so an admin who may edit listing content can also
-- pass `vendors: admin moderate` when the same save writes the business row.
-- If a role is ever given `listing.moderate` without `vendor.verify`, the
-- Business step will save the listing half and refuse the `vendors` half.
--
-- ## Additive, not a rewrite
--
-- Each policy below is a **new** one beside the member policy from 0004 rather
-- than a replacement for it. Policies are OR'd, so this cannot narrow what a
-- vendor may already do to their own row — and it keeps 0004's rules readable
-- as the vendor-side rules they are.

-- ---------------------------------------------------------------------------
-- 1. Listing content
-- ---------------------------------------------------------------------------

drop policy if exists "vendor_listings: admin manage" on public.vendor_listings;
create policy "vendor_listings: admin manage"
  on public.vendor_listings for all to authenticated
  using (public.has_admin_permission('listing.moderate'))
  with check (public.has_admin_permission('listing.moderate'));

drop policy if exists "vendor_categories: admin manage" on public.vendor_categories;
create policy "vendor_categories: admin manage"
  on public.vendor_categories for all to authenticated
  using (public.has_admin_permission('listing.moderate'))
  with check (public.has_admin_permission('listing.moderate'));

drop policy if exists "vendor_service_areas: admin manage" on public.vendor_service_areas;
create policy "vendor_service_areas: admin manage"
  on public.vendor_service_areas for all to authenticated
  using (public.has_admin_permission('listing.moderate'))
  with check (public.has_admin_permission('listing.moderate'));

drop policy if exists "vendor_addresses: admin manage" on public.vendor_addresses;
create policy "vendor_addresses: admin manage"
  on public.vendor_addresses for all to authenticated
  using (public.has_admin_permission('listing.moderate'))
  with check (public.has_admin_permission('listing.moderate'));

drop policy if exists "vendor_attribute_values: admin manage" on public.vendor_attribute_values;
create policy "vendor_attribute_values: admin manage"
  on public.vendor_attribute_values for all to authenticated
  using (public.has_admin_permission('listing.moderate'))
  with check (public.has_admin_permission('listing.moderate'));

drop policy if exists "vendor_media: admin manage" on public.vendor_media;
create policy "vendor_media: admin manage"
  on public.vendor_media for all to authenticated
  using (public.has_admin_permission('listing.moderate'))
  with check (public.has_admin_permission('listing.moderate'));

drop policy if exists "vendor_packages: admin manage" on public.vendor_packages;
create policy "vendor_packages: admin manage"
  on public.vendor_packages for all to authenticated
  using (public.has_admin_permission('listing.moderate'))
  with check (public.has_admin_permission('listing.moderate'));

-- `vendor_availability` carries `note_private`, which is why 0004 keeps the
-- whole table member-only rather than exposing it through a policy — the public
-- signal comes from the `public_vendor_availability` view in 0007. This grant
-- is to staff who moderate listings, not to the public, and the view is
-- untouched.
drop policy if exists "vendor_availability: admin manage" on public.vendor_availability;
create policy "vendor_availability: admin manage"
  on public.vendor_availability for all to authenticated
  using (public.has_admin_permission('listing.moderate'))
  with check (public.has_admin_permission('listing.moderate'));
