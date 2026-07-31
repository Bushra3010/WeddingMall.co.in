-- Seed data for local development.
--
-- Every business, person, review, and image reference below is FICTIONAL
-- (PRD Epic G, 2.3 — do not scrape or import content from any reference site).
-- Names are invented; any resemblance to a real business is coincidental.
--
-- This file seeds taxonomy, plans, CMS, and homepage configuration only. Vendor
-- and customer rows depend on auth.users, which is created through the sign-up
-- flow — see docs/DB.md for the local demo-account recipe.

-- ---------------------------------------------------------------------------
-- Location
-- ---------------------------------------------------------------------------

insert into public.countries (code, name, currency) values ('IN', 'India', 'INR')
on conflict (code) do nothing;

insert into public.states (country_id, name, slug)
select c.id, s.name, s.slug
from public.countries c,
  (values
    ('Maharashtra', 'maharashtra'),
    ('Rajasthan', 'rajasthan'),
    ('Karnataka', 'karnataka'),
    ('Delhi', 'delhi'),
    ('Goa', 'goa'),
    ('Kerala', 'kerala')
  ) as s(name, slug)
where c.code = 'IN'
on conflict (slug) do nothing;

insert into public.cities (state_id, name, slug, latitude, longitude, sort_order, intro_html)
select st.id, c.name, c.slug, c.lat, c.lon, c.ord, c.intro
from public.states st
join (values
  ('maharashtra', 'Mumbai',    'mumbai',    19.076000, 72.877700, 1,
   '<p>From sea-facing banquet halls to heritage courtyards, Mumbai suits couples who want scale without leaving the city.</p>'),
  ('maharashtra', 'Pune',      'pune',      18.520400, 73.856700, 5,
   '<p>Pune pairs garden venues and hill-side resorts with shorter travel times than the coast.</p>'),
  ('rajasthan',   'Jaipur',    'jaipur',    26.912400, 75.787300, 2,
   '<p>Palace lawns, stepwell backdrops, and a long dry season make Jaipur a favourite for winter weddings.</p>'),
  ('rajasthan',   'Udaipur',   'udaipur',   24.585400, 73.712500, 4,
   '<p>Lakeside venues and courtyard havelis suit smaller guest lists and multi-day celebrations.</p>'),
  ('karnataka',   'Bengaluru', 'bengaluru', 12.971600, 77.594600, 3,
   '<p>Bengaluru offers year-round mild weather and a deep bench of photographers and decorators.</p>'),
  ('delhi',       'New Delhi', 'new-delhi', 28.613900, 77.209000, 6,
   '<p>Farmhouse venues on the outskirts and hotel ballrooms in the centre cover most budgets.</p>'),
  ('goa',         'Panaji',    'panaji',    15.490900, 73.827800, 7,
   '<p>Beach and riverside venues, best booked well outside the monsoon months.</p>'),
  ('kerala',      'Kochi',     'kochi',      9.931300, 76.267300, 8,
   '<p>Backwater resorts and heritage properties, popular for intimate ceremonies.</p>')
) as c(state_slug, name, slug, lat, lon, ord, intro) on st.slug = c.state_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

insert into public.categories (name, slug, description, sort_order, intro_html) values
  ('Wedding Venues', 'venues',
   'Banquet halls, hotels, resorts, farmhouses, and heritage properties.', 1,
   '<p>Compare capacity, catering policy, and parking before you shortlist. Most venues quote per plate, with a minimum guest count.</p>'),
  ('Photographers', 'photographers',
   'Candid and traditional photography, films, and pre-wedding shoots.', 2,
   '<p>Ask what the quoted package includes: number of days, crew size, edited images, and delivery time.</p>'),
  ('Makeup Artists', 'makeup-artists',
   'Bridal makeup, party makeup, hair styling, and trials.', 3,
   '<p>Prices are usually quoted per function. Confirm whether travel and a trial are included.</p>'),
  ('Caterers', 'caterers',
   'Multi-cuisine catering, live counters, and bar services.', 4,
   '<p>Caterers quote per plate against a minimum guest count. Confirm tasting sessions and dietary options early.</p>'),
  ('Wedding Planners', 'planners',
   'Full planning, day-of coordination, and destination weddings.', 5,
   '<p>Planners either charge a flat fee or a percentage of total spend. Clarify which before signing.</p>'),
  ('Decorators', 'decorators',
   'Mandap design, floral styling, lighting, and stage decor.', 6,
   '<p>Decor quotes vary hugely with flower choice and scale. Ask for a reference image alongside the quote.</p>'),
  ('Mehendi Artists', 'mehendi-artists',
   'Bridal mehendi, guest mehendi, and modern designs.', 7,
   '<p>Bridal mehendi is priced separately from guest mehendi, which is usually charged per hour.</p>'),
  ('Music and DJs', 'music-and-dj',
   'DJs, live bands, dhol players, and sound systems.', 8,
   '<p>Check whether sound and lighting equipment is included or hired separately.</p>')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Category attributes — these drive the data-driven search filters (PRD 6.2)
-- ---------------------------------------------------------------------------

insert into public.category_attributes
  (category_id, code, label, input_type, data_type, unit, filterable, options_json, sort_order)
select c.id, a.code, a.label, a.input_type, a.data_type, a.unit, a.filterable, a.options::jsonb, a.ord
from public.categories c
join (values
  ('venues', 'capacity', 'Guest capacity', 'number', 'number', 'guests', true, '[]', 1),
  ('venues', 'rooms', 'Rooms available', 'number', 'number', 'rooms', true, '[]', 2),
  ('venues', 'venue_type', 'Venue type', 'select', 'string', null, true,
   '["Banquet hall","Hotel","Resort","Farmhouse","Heritage property","Lawn"]', 3),
  ('venues', 'catering_policy', 'Catering policy', 'select', 'string', null, true,
   '["In-house only","Outside catering allowed","Both"]', 4),
  ('venues', 'parking', 'Parking capacity', 'number', 'number', 'cars', false, '[]', 5),

  ('photographers', 'starting_price', 'Starting price', 'number', 'number', 'INR', true, '[]', 1),
  ('photographers', 'deliverables', 'Deliverables', 'multiselect', 'array', null, true,
   '["Edited photos","Wedding film","Teaser","Album","Drone coverage","Same-day edit"]', 2),
  ('photographers', 'travel', 'Travels outside city', 'boolean', 'boolean', null, true, '[]', 3),
  ('photographers', 'style', 'Style', 'multiselect', 'array', null, true,
   '["Candid","Traditional","Editorial","Documentary"]', 4),

  ('makeup-artists', 'price_per_function', 'Price per function', 'number', 'number', 'INR', true, '[]', 1),
  ('makeup-artists', 'travel', 'Travels to venue', 'boolean', 'boolean', null, true, '[]', 2),
  ('makeup-artists', 'trial_available', 'Trial available', 'boolean', 'boolean', null, true, '[]', 3),

  ('caterers', 'price_per_plate', 'Price per plate', 'number', 'number', 'INR', true, '[]', 1),
  ('caterers', 'cuisine', 'Cuisine', 'multiselect', 'array', null, true,
   '["North Indian","South Indian","Gujarati","Bengali","Continental","Pan-Asian","Jain","Vegan"]', 2),
  ('caterers', 'minimum_guests', 'Minimum guests', 'number', 'number', 'guests', true, '[]', 3)
) as a(category_slug, code, label, input_type, data_type, unit, filterable, options, ord)
  on c.slug = a.category_slug
on conflict (category_id, code) do nothing;

-- ---------------------------------------------------------------------------
-- Plans (PRD 6.10). Prices are placeholders pending PRD 21 decision 7.
-- ---------------------------------------------------------------------------

insert into public.plans
  (code, name, billing_interval, amount_minor, currency, trial_days, sort_order, entitlements_json)
values
  ('free', 'Free', 'monthly', 0, 'INR', 0, 1,
   '{"listings":1,"categories":1,"media":10,"leadQuota":10,"teamSize":1,"analytics":"basic","featured":false,"export":false}'::jsonb),
  ('growth', 'Growth', 'monthly', 199900, 'INR', 14, 2,
   '{"listings":1,"categories":3,"media":60,"leadQuota":100,"teamSize":5,"analytics":"standard","featured":false,"export":true}'::jsonb),
  ('growth_yearly', 'Growth (yearly)', 'yearly', 1999000, 'INR', 14, 3,
   '{"listings":1,"categories":3,"media":60,"leadQuota":100,"teamSize":5,"analytics":"standard","featured":false,"export":true}'::jsonb),
  ('premium', 'Premium', 'monthly', 499900, 'INR', 14, 4,
   '{"listings":3,"categories":6,"media":200,"leadQuota":null,"teamSize":15,"analytics":"advanced","featured":true,"export":true}'::jsonb)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Homepage sections (PRD 6.1 — sections are admin-configurable, not hard-coded)
-- ---------------------------------------------------------------------------

insert into public.homepage_sections (code, title, sort_order, config_json) values
  ('hero',            'Hero search',        1, '{"showKeyword":true}'::jsonb),
  ('categories',      'Browse by category', 2, '{"limit":8}'::jsonb),
  ('featured',        'Featured vendors',   3, '{"limit":8,"strategy":"recommended"}'::jsonb),
  ('how_it_works',    'How it works',       4, '{}'::jsonb),
  ('trust',           'Why couples trust us', 5, '{}'::jsonb),
  ('testimonials',    'Testimonials',       6, '{"limit":3}'::jsonb),
  ('vendor_cta',      'Vendor acquisition', 7, '{}'::jsonb),
  ('cities',          'Popular cities',     8, '{"limit":8}'::jsonb)
on conflict (code) do nothing;

-- Fictional testimonials.
insert into public.testimonials (author_name, author_city, body, sort_order) values
  ('Ananya and Rohit', 'Pune',
   'We shortlisted four venues in an evening and had quotes from all of them by the weekend.', 1),
  ('Meera S.', 'Jaipur',
   'Being able to compare packages side by side saved us a lot of back and forth on the phone.', 2),
  ('Farhan and Zoya', 'Bengaluru',
   'The enquiry thread kept everything in one place, so nothing got lost across three months of planning.', 3)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- FAQs
-- ---------------------------------------------------------------------------

insert into public.faqs (scope, question, answer, sort_order) values
  ('global', 'Does it cost anything to contact a vendor?',
   'No. Searching, shortlisting, and sending enquiries are free for couples.', 1),
  ('global', 'How are vendors verified?',
   'Vendors submit business documents before a listing can be published. A verified badge means those documents were reviewed and accepted.', 2),
  ('global', 'Who can leave a review?',
   'Only signed-in customers who have an enquiry with that vendor. Every review is moderated before it appears.', 3),
  ('global', 'Will my phone number be shared with vendors?',
   'Only if you consent when sending an enquiry. You can reply in the thread without sharing contact details.', 4)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- CMS pages (placeholder copy — legal text requires counsel review, PRD 14.3)
-- ---------------------------------------------------------------------------

insert into public.pages (slug, title, body, status, published_at) values
  ('about', 'About us',
   'We help couples find and compare wedding professionals, and help those businesses reach couples who are actively planning.',
   'published', now()),
  ('privacy', 'Privacy policy',
   'PLACEHOLDER. This document must be drafted and reviewed by qualified counsel before launch (PRD 14.3).',
   'draft', null),
  ('terms', 'Terms of use',
   'PLACEHOLDER. This document must be drafted and reviewed by qualified counsel before launch (PRD 14.3).',
   'draft', null)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Notification templates (PRD 6.12)
-- ---------------------------------------------------------------------------

insert into public.notification_templates (code, channel, subject, body) values
  ('enquiry.new.vendor', 'email', 'New enquiry for {{vendor_name}}',
   'You have a new enquiry from {{customer_first_name}} for {{event_date}}. Open your dashboard to respond.'),
  ('enquiry.reminder.vendor', 'email', 'An enquiry is still waiting for your reply',
   'An enquiry received {{hours_elapsed}} hours ago has not been answered yet.'),
  ('message.new', 'email', 'New message about your enquiry',
   'You have a new message in your enquiry thread with {{counterparty_name}}.'),
  ('verification.approved', 'email', 'Your business has been verified',
   'Congratulations — {{vendor_name}} is now verified and your listing can be published.'),
  ('verification.rejected', 'email', 'We could not verify your business',
   'We could not verify {{vendor_name}}. Reason: {{reason}}. You can submit updated documents at any time.'),
  ('review.approved', 'email', 'Your review has been published',
   'Your review of {{vendor_name}} is now visible on their profile.')
on conflict (code, channel, locale, version) do nothing;
