-- 0010  Let admins read the listing content they are being asked to moderate.
--
-- Found by driving the real admin UI: the verification queue rendered
-- "Category: —" for a pending submission. The data was correct; the admin
-- simply could not see it.
--
-- These four child tables had exactly two policies each:
--   * public read  — requires vendors.status = 'active' (a pending vendor is not)
--   * member write — requires vendor_can(...), and an admin is not a member
--
-- So an admin reviewing a submission saw the vendor and its listing but none of
-- its categories, service areas, packages, or photos. They were being asked to
-- approve a listing whose contents were invisible to them.
--
-- Gated on `vendor.read`, matching that permission's description ("View vendor
-- accounts and listings"). This is business content, not PII — customer contact
-- details remain behind `user.support`, and verification documents remain
-- behind `vendor.verify`.

create policy "vendor_categories: admin read"
  on public.vendor_categories for select to authenticated
  using (public.has_admin_permission('vendor.read'));

create policy "vendor_service_areas: admin read"
  on public.vendor_service_areas for select to authenticated
  using (public.has_admin_permission('vendor.read'));

create policy "vendor_packages: admin read"
  on public.vendor_packages for select to authenticated
  using (public.has_admin_permission('vendor.read'));

create policy "vendor_media: admin read"
  on public.vendor_media for select to authenticated
  using (public.has_admin_permission('vendor.read'));

-- Attribute values are part of the same review surface.
create policy "vendor_attribute_values: admin read"
  on public.vendor_attribute_values for select to authenticated
  using (public.has_admin_permission('vendor.read'));

-- An admin also needs to see a vendor's business address while verifying it,
-- even when the vendor has not marked it publicly visible.
create policy "vendor_addresses: admin read"
  on public.vendor_addresses for select to authenticated
  using (public.has_admin_permission('vendor.verify'));
