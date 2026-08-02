-- ---------------------------------------------------------------------------
-- 0026 — All Indian states and union territories
--
-- Only six states were seeded, because Milestone 1 seeded exactly the states
-- the eight demo vendors sit in. That is fine for a demo and wrong for an
-- admin adding a real city: the state dropdown has to offer everywhere the
-- marketplace could operate, not everywhere it currently does.
--
-- 28 states plus 8 union territories, as constituted today — Ladakh and Jammu
-- and Kashmir separate (2019), and Dadra and Nagar Haveli merged with Daman
-- and Diu (2020).
--
-- `on conflict (slug) do nothing` so the six already present keep their ids,
-- which matters because cities reference them.
--
-- Every row lands `active = false` except the six already in use. A state with
-- no cities and no vendors would otherwise appear in public city filters as an
-- empty destination — an admin activates one when there is something in it.
-- ---------------------------------------------------------------------------

insert into public.states (country_id, name, slug, active)
select c.id, v.name, v.slug, false
from public.countries c
cross join (values
  -- States
  ('Andhra Pradesh',              'andhra-pradesh'),
  ('Arunachal Pradesh',           'arunachal-pradesh'),
  ('Assam',                       'assam'),
  ('Bihar',                       'bihar'),
  ('Chhattisgarh',                'chhattisgarh'),
  ('Goa',                         'goa'),
  ('Gujarat',                     'gujarat'),
  ('Haryana',                     'haryana'),
  ('Himachal Pradesh',            'himachal-pradesh'),
  ('Jharkhand',                   'jharkhand'),
  ('Karnataka',                   'karnataka'),
  ('Kerala',                      'kerala'),
  ('Madhya Pradesh',              'madhya-pradesh'),
  ('Maharashtra',                 'maharashtra'),
  ('Manipur',                     'manipur'),
  ('Meghalaya',                   'meghalaya'),
  ('Mizoram',                     'mizoram'),
  ('Nagaland',                    'nagaland'),
  ('Odisha',                      'odisha'),
  ('Punjab',                      'punjab'),
  ('Rajasthan',                   'rajasthan'),
  ('Sikkim',                      'sikkim'),
  ('Tamil Nadu',                  'tamil-nadu'),
  ('Telangana',                   'telangana'),
  ('Tripura',                     'tripura'),
  ('Uttar Pradesh',               'uttar-pradesh'),
  ('Uttarakhand',                 'uttarakhand'),
  ('West Bengal',                 'west-bengal'),
  -- Union territories
  ('Andaman and Nicobar Islands', 'andaman-and-nicobar-islands'),
  ('Chandigarh',                  'chandigarh'),
  ('Dadra and Nagar Haveli and Daman and Diu', 'dadra-and-nagar-haveli-and-daman-and-diu'),
  ('Delhi',                       'delhi'),
  ('Jammu and Kashmir',           'jammu-and-kashmir'),
  ('Ladakh',                      'ladakh'),
  ('Lakshadweep',                 'lakshadweep'),
  ('Puducherry',                  'puducherry')
) as v(name, slug)
where c.code = 'IN'
on conflict (slug) do nothing;

-- A state that already holds a city stays active regardless of the above.
update public.states s
set active = true
where exists (select 1 from public.cities ci where ci.state_id = s.id);
