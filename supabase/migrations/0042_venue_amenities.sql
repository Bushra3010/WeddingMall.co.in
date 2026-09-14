-- 0042  Venue amenity attributes.
--
-- The public vendor page now renders a facilities grid from the vendor's
-- attribute answers (PRD 6.2). The venues category could only describe guest
-- capacity, rooms, venue type, catering policy and parking — nothing about the
-- facilities couples actually shortlist on: a bridal room, a lawn, air
-- conditioning, power backup, Wi-Fi.
--
-- These belong in `category_attributes` rather than new columns on `vendors`,
-- because the same rows drive the category filters. Adding a boolean here also
-- adds "Swimming pool" to the venue filter sidebar, so the grid and the filter
-- can never disagree.
--
-- The original set was seeded in `supabase/seed.sql`, which does not re-run on
-- a project that already has data — hence a migration. `seed.sql` carries the
-- same rows so a fresh database ends up identical; both are `on conflict do
-- nothing`, so applying this twice, or after a fresh seed, is a no-op.
--
-- Existing sort orders in `venues` run 1..5. These continue from 6 so the
-- established fields keep leading the form the vendor fills in.

insert into public.category_attributes
  (category_id, code, label, input_type, data_type, unit, filterable, options_json, sort_order)
select c.id, a.code, a.label, a.input_type, a.data_type, a.unit, a.filterable, '[]'::jsonb, a.ord
from public.categories c
join (values
  ('venues', 'halls',          'Banquet halls',            'number',  'number',  'halls', true,  6),
  ('venues', 'ac_rooms',       'Air-conditioned rooms',    'number',  'number',  'rooms', false, 7),
  ('venues', 'lawns',          'Lawns',                    'number',  'number',  'lawns', true,  8),
  ('venues', 'bridal_room',    'Bridal room',              'boolean', 'boolean', null,    true,  9),
  ('venues', 'garden',         'Garden',                   'boolean', 'boolean', null,    true, 10),
  ('venues', 'swimming_pool',  'Swimming pool',            'boolean', 'boolean', null,    true, 11),
  ('venues', 'dining_area',    'Dining area',              'boolean', 'boolean', null,    false, 12),
  ('venues', 'power_backup',   'Power backup',             'boolean', 'boolean', null,    true, 13),
  ('venues', 'wifi',           'Wi-Fi',                    'boolean', 'boolean', null,    true, 14)
) as a(category_slug, code, label, input_type, data_type, unit, filterable, ord)
  on c.slug = a.category_slug
on conflict (category_id, code) do nothing;
