-- 0043  Questions for wedding cars and pandits.
--
-- Both categories were created from the admin panel on the live project
-- (slugs `car` and `pandit-jee-01`) with no attributes, so a car owner or a
-- pandit registering got the generic profile and nothing specific to them.
--
-- Everything that is not a property of the service itself already has a home
-- and is deliberately not repeated here:
--
--   name, mobile, email, address, city   → the business profile
--   photos (car photos, profile photo)   → portfolio
--   RC, insurance, permit, Aadhaar, ID,
--   address proof, certificates          → verification documents
--   service area                         → service areas
--   service-wise pricing                 → packages
--   available days / slots               → availability
--   bank / UPI                           → bank details
--   admin approval + verified badge      → moderation (unchanged)
--
-- Registration number and date of birth are private (`is_public = false`):
-- seen by the vendor and admins, never on the public page or via anon.
--
-- `required = true` is enforced when the vendor saves their answers
-- (`writeAttributeValues`). The admin editor may save a partial set.
--
-- A database without these categories (a fresh seed) simply inserts nothing.
-- `on conflict do nothing`, so applying this twice is a no-op and never
-- overwrites a question an admin has since edited.

-- ---------------------------------------------------------------------------
-- Private answers
-- ---------------------------------------------------------------------------
--
-- Until now every answer was public: "vendor_attribute_values: public read"
-- (0004) lets anon read every row of an active vendor, and the public page
-- renders them all as amenities. A pandit's date of birth and a car's
-- registration number are for the admin checking them, not for the internet.
--
-- `is_public = false` hides an answer from anon and from other users. The
-- vendor still reads it through "member write" (for all), and admins through
-- "admin read" (0010) — neither policy is touched.

alter table public.category_attributes
  add column if not exists is_public boolean not null default true;

drop policy if exists "vendor_attribute_values: public read" on public.vendor_attribute_values;
create policy "vendor_attribute_values: public read"
  on public.vendor_attribute_values for select to anon, authenticated
  using (
    exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'active')
    and exists (
      select 1 from public.category_attributes ca
      where ca.id = category_attribute_id and ca.is_public
    )
  );

-- ---------------------------------------------------------------------------
-- The questions
-- ---------------------------------------------------------------------------

insert into public.category_attributes
  (category_id, code, label, help_text, input_type, data_type, unit, filterable, required,
   options_json, sort_order, is_public)
select c.id, a.code, a.label, a.help_text, a.input_type, a.data_type, a.unit, a.filterable,
       a.required, a.options::jsonb, a.ord,
       a.code not in ('registration_number', 'date_of_birth')
from public.categories c
join (values
  -- Wedding cars ------------------------------------------------------------
  ('car', 'car_model', 'Car brand & model', 'For example: Mercedes-Benz E-Class',
   'text', 'string', null, false, true, '[]', 1),
  ('car', 'car_variant', 'Variant', 'For example: E 220d',
   'text', 'string', null, false, true, '[]', 2),
  ('car', 'manufacturing_year', 'Manufacturing year', null,
   'number', 'number', null, false, true, '[]', 3),
  ('car', 'registration_number', 'Registration number', 'As printed on the RC, e.g. BR01AB1234',
   'text', 'string', null, false, true, '[]', 4),
  ('car', 'fuel_type', 'Fuel type', null,
   'select', 'string', null, true, true, '["Petrol","Diesel","CNG","Electric","Hybrid"]', 5),
  ('car', 'transmission', 'Transmission', null,
   'select', 'string', null, true, true, '["Manual","Automatic"]', 6),
  ('car', 'seating_capacity', 'Seating capacity', null,
   'number', 'number', 'seats', true, true, '[]', 7),

  -- Pandits -----------------------------------------------------------------
  ('pandit-jee-01', 'date_of_birth', 'Date of birth', 'DD-MM-YYYY',
   'text', 'string', null, false, true, '[]', 1),
  ('pandit-jee-01', 'gender', 'Gender', null,
   'select', 'string', null, false, true, '["Male","Female","Other"]', 2),
  ('pandit-jee-01', 'sampradaya', 'Sampradaya', null,
   'text', 'string', null, false, false, '[]', 3),
  ('pandit-jee-01', 'gotra', 'Gotra', null,
   'text', 'string', null, false, false, '[]', 4),
  ('pandit-jee-01', 'languages', 'Languages', null,
   'multiselect', 'array', null, true, true,
   '["Hindi","Sanskrit","Bhojpuri","Maithili","Magahi","English","Bengali","Marathi","Gujarati","Punjabi","Tamil","Telugu"]', 5),
  ('pandit-jee-01', 'specialization', 'Specialization', 'For example: Vedic vivah, Jyotish, Karmakand',
   'text', 'string', null, false, false, '[]', 6),
  ('pandit-jee-01', 'services', 'Services offered', null,
   'multiselect', 'array', null, true, true,
   '["Puja","Vivah","Grah Pravesh","Mundan","Satyanarayan Katha","Namkaran","Rudrabhishek","Havan","Sundarkand Path","Shraddh"]', 7),
  ('pandit-jee-01', 'experience_years', 'Experience', null,
   'number', 'number', 'years', true, true, '[]', 8),
  ('pandit-jee-01', 'qualification', 'Qualification / training', 'Gurukul, Sanskrit university, etc.',
   'text', 'string', null, false, false, '[]', 9),
  ('pandit-jee-01', 'travel_charges', 'Travel charges', 'Leave 0 if travel is included',
   'number', 'number', 'INR', false, false, '[]', 10)
) as a(category_slug, code, label, help_text, input_type, data_type, unit, filterable, required,
       options, ord)
  on c.slug = a.category_slug
on conflict (category_id, code) do nothing;
