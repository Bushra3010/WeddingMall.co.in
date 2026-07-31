-- 0003  Locations and category taxonomy.
-- PRD 9.2, 6.2 (data-driven category filters), 10.2.

create table public.countries (
  id         uuid primary key default extensions.gen_random_uuid(),
  code       char(2) not null unique,
  name       text not null,
  currency   char(3) not null default 'INR',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.states (
  id         uuid primary key default extensions.gen_random_uuid(),
  country_id uuid not null references public.countries (id) on delete cascade,
  name       text not null,
  slug       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cities (
  id         uuid primary key default extensions.gen_random_uuid(),
  state_id   uuid not null references public.states (id) on delete cascade,
  name       text not null,
  slug       text not null unique,
  latitude   numeric(9, 6),
  longitude  numeric(9, 6),
  timezone   text not null default 'Asia/Kolkata',
  aliases    text[] not null default '{}',
  seo_title       text,
  seo_description text,
  intro_html      text,
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cities_updated_at
  before update on public.cities
  for each row execute function public.set_updated_at();

create index cities_state_idx on public.cities (state_id) where active;
create index cities_name_trgm_idx on public.cities using gin (name extensions.gin_trgm_ops);

create table public.areas (
  id         uuid primary key default extensions.gen_random_uuid(),
  city_id    uuid not null references public.cities (id) on delete cascade,
  name       text not null,
  slug       text not null,
  latitude   numeric(9, 6),
  longitude  numeric(9, 6),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (city_id, slug)
);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id          uuid primary key default extensions.gen_random_uuid(),
  parent_id   uuid references public.categories (id) on delete restrict,
  name        text not null,
  slug        text not null unique,
  icon        text,
  description text,
  seo_title       text,
  seo_description text,
  intro_html      text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create index categories_parent_idx on public.categories (parent_id) where active;
create index categories_name_trgm_idx on public.categories using gin (name extensions.gin_trgm_ops);

create table public.category_attributes (
  id              uuid primary key default extensions.gen_random_uuid(),
  category_id     uuid not null references public.categories (id) on delete cascade,
  code            text not null,
  label           text not null,
  help_text       text,
  input_type      text not null check (
                    input_type in ('text','number','select','multiselect','boolean','range')),
  data_type       text not null check (data_type in ('string','number','boolean','array')),
  unit            text,
  filterable      boolean not null default false,
  required        boolean not null default false,
  options_json    jsonb not null default '[]'::jsonb,
  validation_json jsonb not null default '{}'::jsonb,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (category_id, code)
);

create index category_attributes_filterable_idx
  on public.category_attributes (category_id) where filterable;

-- ---------------------------------------------------------------------------
-- slug redirects (PRD 9.3, 11.2 — clean 301s when a slug changes)
-- ---------------------------------------------------------------------------

create table public.slug_redirects (
  id          uuid primary key default extensions.gen_random_uuid(),
  entity_type text not null check (entity_type in ('vendor','category','city','post','page')),
  entity_id   uuid,
  old_slug    text not null,
  new_slug    text not null,
  status_code integer not null default 301 check (status_code in (301, 302, 308)),
  created_at  timestamptz not null default now(),
  unique (entity_type, old_slug)
);

-- ---------------------------------------------------------------------------
-- RLS: taxonomy is public read, admin write.
-- ---------------------------------------------------------------------------

alter table public.countries           enable row level security;
alter table public.states              enable row level security;
alter table public.cities              enable row level security;
alter table public.areas               enable row level security;
alter table public.categories          enable row level security;
alter table public.category_attributes enable row level security;
alter table public.slug_redirects      enable row level security;

create policy "countries: public read active"
  on public.countries for select to anon, authenticated using (active);
create policy "states: public read active"
  on public.states for select to anon, authenticated using (active);
create policy "cities: public read active"
  on public.cities for select to anon, authenticated using (active);
create policy "areas: public read active"
  on public.areas for select to anon, authenticated using (active);
create policy "categories: public read active"
  on public.categories for select to anon, authenticated using (active);
create policy "category_attributes: public read"
  on public.category_attributes for select to anon, authenticated using (true);
create policy "slug_redirects: public read"
  on public.slug_redirects for select to anon, authenticated using (true);

-- Taxonomy writes require an admin permission. `for all` covers the inactive
-- rows an admin needs to see while editing.
create policy "countries: admin write"
  on public.countries for all to authenticated
  using (public.has_admin_permission('admin.manage'))
  with check (public.has_admin_permission('admin.manage'));

create policy "states: admin write"
  on public.states for all to authenticated
  using (public.has_admin_permission('admin.manage'))
  with check (public.has_admin_permission('admin.manage'));

create policy "cities: admin write"
  on public.cities for all to authenticated
  using (public.has_admin_permission('admin.manage'))
  with check (public.has_admin_permission('admin.manage'));

create policy "areas: admin write"
  on public.areas for all to authenticated
  using (public.has_admin_permission('admin.manage'))
  with check (public.has_admin_permission('admin.manage'));

create policy "categories: admin write"
  on public.categories for all to authenticated
  using (public.has_admin_permission('admin.manage'))
  with check (public.has_admin_permission('admin.manage'));

create policy "category_attributes: admin write"
  on public.category_attributes for all to authenticated
  using (public.has_admin_permission('admin.manage'))
  with check (public.has_admin_permission('admin.manage'));

create policy "slug_redirects: admin write"
  on public.slug_redirects for all to authenticated
  using (public.has_admin_permission('admin.manage'))
  with check (public.has_admin_permission('admin.manage'));
