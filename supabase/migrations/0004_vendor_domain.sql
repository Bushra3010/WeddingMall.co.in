-- 0004  Vendor organisations, memberships, listings, media, packages.
-- PRD 9.3, 4.4, 6.3, 6.9, 10.2.

create table public.vendors (
  id                  uuid primary key default extensions.gen_random_uuid(),
  legal_name          text,
  display_name        text not null,
  slug                text not null unique,
  owner_user_id       uuid not null references public.profiles (id) on delete restrict,
  status              public.vendor_status not null default 'draft',
  verification_status public.verification_status not null default 'unverified',
  primary_city_id     uuid references public.cities (id) on delete set null,
  email               text,
  phone               text,
  website             text,
  founded_year        integer check (founded_year between 1900 and 2100),
  plan_id             uuid,
  suspended_reason    text,
  rating_average      numeric(3, 2) not null default 0
                        check (rating_average >= 0 and rating_average <= 5),
  rating_count        integer not null default 0 check (rating_count >= 0),
  response_score      numeric(5, 4) not null default 0,
  listing_quality     numeric(5, 4) not null default 0,
  plan_boost          numeric(5, 4) not null default 0,
  is_featured         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  published_at        timestamptz
);

create trigger vendors_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

create index vendors_public_idx on public.vendors (primary_city_id, status)
  where status = 'active';
create index vendors_owner_idx on public.vendors (owner_user_id);
create index vendors_name_trgm_idx
  on public.vendors using gin (display_name extensions.gin_trgm_ops);

create table public.vendor_memberships (
  id         uuid primary key default extensions.gen_random_uuid(),
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.vendor_role not null default 'vendor_viewer',
  status     public.membership_status not null default 'invited',
  invited_by uuid references public.profiles (id) on delete set null,
  invited_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, user_id)
);

create trigger vendor_memberships_updated_at
  before update on public.vendor_memberships
  for each row execute function public.set_updated_at();

create index vendor_memberships_user_idx
  on public.vendor_memberships (user_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- Membership helpers. SECURITY DEFINER so that a policy on vendor_memberships
-- can call them without recursing into its own policy.
-- ---------------------------------------------------------------------------

create or replace function public.vendor_role_of(target_vendor uuid)
returns public.vendor_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.vendor_memberships m
  where m.vendor_id = target_vendor
    and m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.is_vendor_member(target_vendor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.vendor_role_of(target_vendor) is not null;
$$;

/*
 * Capability check mirroring VENDOR_ROLE_CAPABILITIES in
 * src/lib/permissions/catalogue.ts. Keep the two in step.
 */
create or replace function public.vendor_can(target_vendor uuid, capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.vendor_role_of(target_vendor)
    when 'vendor_owner' then true
    when 'vendor_manager' then capability <> 'team.transfer_owner'
                             and capability <> 'billing.manage'
                             and capability <> 'vendor.delete_request'
    when 'vendor_sales' then capability in
      ('lead.view','lead.view_pii','lead.respond','note.manage','analytics.view')
    when 'vendor_editor' then capability in
      ('listing.edit','package.manage','media.manage','availability.manage',
       'lead.view','analytics.view')
    when 'vendor_viewer' then capability = 'analytics.view'
    else false
  end;
$$;

revoke execute on function public.vendor_role_of(uuid) from public;
revoke execute on function public.is_vendor_member(uuid) from public;
revoke execute on function public.vendor_can(uuid, text) from public;
grant execute on function public.vendor_role_of(uuid) to authenticated;
grant execute on function public.is_vendor_member(uuid) to authenticated;
grant execute on function public.vendor_can(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- vendor detail tables
-- ---------------------------------------------------------------------------

create table public.vendor_categories (
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  is_primary  boolean not null default false,
  primary key (vendor_id, category_id)
);

create unique index vendor_categories_one_primary_idx
  on public.vendor_categories (vendor_id) where is_primary;
create index vendor_categories_category_idx on public.vendor_categories (category_id);

-- `area_id` is optional (whole-city coverage), so it cannot sit in a primary
-- key. Uniqueness is enforced by two partial indexes instead.
create table public.vendor_service_areas (
  id               uuid primary key default extensions.gen_random_uuid(),
  vendor_id        uuid not null references public.vendors (id) on delete cascade,
  city_id          uuid not null references public.cities (id) on delete cascade,
  area_id          uuid references public.areas (id) on delete cascade,
  travel_available boolean not null default false
);

create unique index vendor_service_areas_area_idx
  on public.vendor_service_areas (vendor_id, city_id, area_id) where area_id is not null;
create unique index vendor_service_areas_city_wide_idx
  on public.vendor_service_areas (vendor_id, city_id) where area_id is null;
create index vendor_service_areas_city_idx on public.vendor_service_areas (city_id);

create table public.vendor_addresses (
  id                uuid primary key default extensions.gen_random_uuid(),
  vendor_id         uuid not null references public.vendors (id) on delete cascade,
  type              text not null default 'business'
                      check (type in ('business','billing','venue')),
  line1             text,
  line2             text,
  city_id           uuid references public.cities (id) on delete set null,
  postal_code       text,
  latitude          numeric(9, 6),
  longitude         numeric(9, 6),
  public_visibility boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger vendor_addresses_updated_at
  before update on public.vendor_addresses
  for each row execute function public.set_updated_at();

-- Verification documents live in a PRIVATE storage bucket; only the path is
-- stored here (PRD 10.1).
create table public.vendor_verifications (
  id           uuid primary key default extensions.gen_random_uuid(),
  vendor_id    uuid not null references public.vendors (id) on delete cascade,
  type         text not null,
  status       public.verification_status not null default 'pending',
  submitted_at timestamptz,
  decided_at   timestamptz,
  reviewer_id  uuid references public.profiles (id) on delete set null,
  reason       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger vendor_verifications_updated_at
  before update on public.vendor_verifications
  for each row execute function public.set_updated_at();

create index vendor_verifications_queue_idx
  on public.vendor_verifications (status, submitted_at);

create table public.vendor_documents (
  id              uuid primary key default extensions.gen_random_uuid(),
  verification_id uuid not null references public.vendor_verifications (id) on delete cascade,
  storage_path    text not null,
  document_type   text not null,
  hash            text,
  expiry_date     date,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- listings and versions
-- ---------------------------------------------------------------------------

create table public.vendor_listings (
  id               uuid primary key default extensions.gen_random_uuid(),
  vendor_id        uuid not null references public.vendors (id) on delete cascade,
  status           public.moderation_status not null default 'draft',
  about            text,
  experience_years integer check (experience_years >= 0),
  languages        text[] not null default '{}',
  policies_json    jsonb not null default '{}'::jsonb,
  faqs_json        jsonb not null default '[]'::jsonb,
  completion_score integer not null default 0 check (completion_score between 0 and 100),
  submitted_at     timestamptz,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (vendor_id)
);

create trigger vendor_listings_updated_at
  before update on public.vendor_listings
  for each row execute function public.set_updated_at();

create index vendor_listings_status_idx on public.vendor_listings (status, published_at desc);

-- The published snapshot the public page reads. Editing a draft never mutates
-- the approved version (PRD 6.9).
create table public.vendor_listing_versions (
  id            uuid primary key default extensions.gen_random_uuid(),
  listing_id    uuid not null references public.vendor_listings (id) on delete cascade,
  version_no    integer not null,
  snapshot_json jsonb not null,
  status        public.moderation_status not null default 'pending',
  reviewer_id   uuid references public.profiles (id) on delete set null,
  reason        text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  unique (listing_id, version_no)
);

create index vendor_listing_versions_queue_idx
  on public.vendor_listing_versions (status, created_at);

create table public.vendor_attribute_values (
  vendor_id             uuid not null references public.vendors (id) on delete cascade,
  category_attribute_id uuid not null references public.category_attributes (id) on delete cascade,
  value_json            jsonb not null,
  primary key (vendor_id, category_attribute_id)
);

create index vendor_attribute_values_attr_idx
  on public.vendor_attribute_values (category_attribute_id);

create table public.vendor_media (
  id                uuid primary key default extensions.gen_random_uuid(),
  vendor_id         uuid not null references public.vendors (id) on delete cascade,
  listing_id        uuid references public.vendor_listings (id) on delete set null,
  type              text not null default 'image' check (type in ('image','video')),
  storage_path      text not null,
  alt_text          text,
  sort_order        integer not null default 0,
  is_cover          boolean not null default false,
  moderation_status public.moderation_status not null default 'pending',
  width             integer,
  height            integer,
  size_bytes        bigint,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger vendor_media_updated_at
  before update on public.vendor_media
  for each row execute function public.set_updated_at();

create index vendor_media_vendor_idx on public.vendor_media (vendor_id, sort_order);
create unique index vendor_media_one_cover_idx on public.vendor_media (vendor_id) where is_cover;

create table public.vendor_packages (
  id               uuid primary key default extensions.gen_random_uuid(),
  vendor_id        uuid not null references public.vendors (id) on delete cascade,
  category_id      uuid references public.categories (id) on delete set null,
  name             text not null,
  description      text,
  price_type       public.price_type not null default 'starting_at',
  min_amount_minor bigint check (min_amount_minor >= 0),
  max_amount_minor bigint check (max_amount_minor >= 0),
  currency         char(3) not null default 'INR',
  unit             text,
  inclusions_json  jsonb not null default '[]'::jsonb,
  exclusions_json  jsonb not null default '[]'::jsonb,
  active           boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint vendor_packages_range_ordered
    check (min_amount_minor is null or max_amount_minor is null
           or min_amount_minor <= max_amount_minor),
  constraint vendor_packages_range_needs_bounds
    check (price_type <> 'range' or (min_amount_minor is not null and max_amount_minor is not null))
);

create trigger vendor_packages_updated_at
  before update on public.vendor_packages
  for each row execute function public.set_updated_at();

create index vendor_packages_vendor_idx on public.vendor_packages (vendor_id, sort_order)
  where active;

create table public.vendor_availability (
  id           uuid primary key default extensions.gen_random_uuid(),
  vendor_id    uuid not null references public.vendors (id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  status       public.availability_status not null default 'unknown',
  note_private text,
  created_at   timestamptz not null default now(),
  constraint vendor_availability_ordered check (start_date <= end_date)
);

create index vendor_availability_vendor_idx
  on public.vendor_availability (vendor_id, start_date, end_date);

create table public.vendor_metrics_daily (
  vendor_id      uuid not null references public.vendors (id) on delete cascade,
  date           date not null,
  profile_views  integer not null default 0,
  shortlist_adds integer not null default 0,
  enquiries      integer not null default 0,
  messages       integer not null default 0,
  booked_count   integer not null default 0,
  primary key (vendor_id, date)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.vendors                 enable row level security;
alter table public.vendor_memberships      enable row level security;
alter table public.vendor_categories       enable row level security;
alter table public.vendor_service_areas    enable row level security;
alter table public.vendor_addresses        enable row level security;
alter table public.vendor_verifications    enable row level security;
alter table public.vendor_documents        enable row level security;
alter table public.vendor_listings         enable row level security;
alter table public.vendor_listing_versions enable row level security;
alter table public.vendor_attribute_values enable row level security;
alter table public.vendor_media            enable row level security;
alter table public.vendor_packages         enable row level security;
alter table public.vendor_availability     enable row level security;
alter table public.vendor_metrics_daily    enable row level security;

-- Public reads go through the `public_vendors` view in migration 0007, which
-- exposes only approved columns. The base-table policy still restricts rows to
-- active vendors so nothing leaks through PostgREST embedding.
create policy "vendors: public read active"
  on public.vendors for select to anon, authenticated
  using (status = 'active');

create policy "vendors: member read"
  on public.vendors for select to authenticated
  using (public.is_vendor_member(id) or public.has_admin_permission('vendor.read'));

create policy "vendors: member update"
  on public.vendors for update to authenticated
  using (public.vendor_can(id, 'listing.edit'))
  with check (public.vendor_can(id, 'listing.edit'));

-- Vendor creation is an onboarding service action: the creator becomes owner.
create policy "vendors: create own"
  on public.vendors for insert to authenticated
  with check ((select auth.uid()) = owner_user_id and status = 'draft');

create policy "vendor_memberships: self read"
  on public.vendor_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_vendor_member(vendor_id)
    or public.has_admin_permission('vendor.read')
  );

create policy "vendor_memberships: manage"
  on public.vendor_memberships for all to authenticated
  using (public.vendor_can(vendor_id, 'team.manage'))
  with check (public.vendor_can(vendor_id, 'team.manage'));

-- Child tables of an active vendor are publicly readable; drafts are member-only.
create policy "vendor_categories: public read"
  on public.vendor_categories for select to anon, authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'active'));
create policy "vendor_categories: member write"
  on public.vendor_categories for all to authenticated
  using (public.vendor_can(vendor_id, 'listing.edit'))
  with check (public.vendor_can(vendor_id, 'listing.edit'));

create policy "vendor_service_areas: public read"
  on public.vendor_service_areas for select to anon, authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'active'));
create policy "vendor_service_areas: member write"
  on public.vendor_service_areas for all to authenticated
  using (public.vendor_can(vendor_id, 'listing.edit'))
  with check (public.vendor_can(vendor_id, 'listing.edit'));

create policy "vendor_addresses: public read visible"
  on public.vendor_addresses for select to anon, authenticated
  using (
    public_visibility
    and exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'active')
  );
create policy "vendor_addresses: member write"
  on public.vendor_addresses for all to authenticated
  using (public.vendor_can(vendor_id, 'listing.edit'))
  with check (public.vendor_can(vendor_id, 'listing.edit'));

-- Verification records and documents are never public.
create policy "vendor_verifications: member read"
  on public.vendor_verifications for select to authenticated
  using (
    public.vendor_can(vendor_id, 'team.manage')
    or public.has_admin_permission('vendor.verify')
  );
create policy "vendor_verifications: member submit"
  on public.vendor_verifications for insert to authenticated
  with check (public.vendor_can(vendor_id, 'team.manage'));
create policy "vendor_verifications: admin decide"
  on public.vendor_verifications for update to authenticated
  using (public.has_admin_permission('vendor.verify'))
  with check (public.has_admin_permission('vendor.verify'));

create policy "vendor_documents: member read"
  on public.vendor_documents for select to authenticated
  using (exists (
    select 1 from public.vendor_verifications v
    where v.id = verification_id
      and (public.vendor_can(v.vendor_id, 'team.manage')
           or public.has_admin_permission('vendor.verify'))
  ));
create policy "vendor_documents: member insert"
  on public.vendor_documents for insert to authenticated
  with check (exists (
    select 1 from public.vendor_verifications v
    where v.id = verification_id and public.vendor_can(v.vendor_id, 'team.manage')
  ));

create policy "vendor_listings: public read published"
  on public.vendor_listings for select to anon, authenticated
  using (
    status = 'approved'
    and exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'active')
  );
create policy "vendor_listings: member read"
  on public.vendor_listings for select to authenticated
  using (public.is_vendor_member(vendor_id) or public.has_admin_permission('listing.moderate'));
create policy "vendor_listings: member write"
  on public.vendor_listings for all to authenticated
  using (public.vendor_can(vendor_id, 'listing.edit'))
  with check (public.vendor_can(vendor_id, 'listing.edit'));

create policy "vendor_listing_versions: member read"
  on public.vendor_listing_versions for select to authenticated
  using (exists (
    select 1 from public.vendor_listings l
    where l.id = listing_id
      and (public.is_vendor_member(l.vendor_id)
           or public.has_admin_permission('listing.moderate'))
  ));
create policy "vendor_listing_versions: admin moderate"
  on public.vendor_listing_versions for update to authenticated
  using (public.has_admin_permission('listing.moderate'))
  with check (public.has_admin_permission('listing.moderate'));

create policy "vendor_attribute_values: public read"
  on public.vendor_attribute_values for select to anon, authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'active'));
create policy "vendor_attribute_values: member write"
  on public.vendor_attribute_values for all to authenticated
  using (public.vendor_can(vendor_id, 'listing.edit'))
  with check (public.vendor_can(vendor_id, 'listing.edit'));

create policy "vendor_media: public read approved"
  on public.vendor_media for select to anon, authenticated
  using (
    moderation_status = 'approved'
    and exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'active')
  );
create policy "vendor_media: member read"
  on public.vendor_media for select to authenticated
  using (public.is_vendor_member(vendor_id) or public.has_admin_permission('listing.moderate'));
create policy "vendor_media: member write"
  on public.vendor_media for all to authenticated
  using (public.vendor_can(vendor_id, 'media.manage'))
  with check (public.vendor_can(vendor_id, 'media.manage'));

create policy "vendor_packages: public read active"
  on public.vendor_packages for select to anon, authenticated
  using (
    active
    and exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'active')
  );
create policy "vendor_packages: member write"
  on public.vendor_packages for all to authenticated
  using (public.vendor_can(vendor_id, 'package.manage'))
  with check (public.vendor_can(vendor_id, 'package.manage'));

-- `note_private` must never reach the public profile, so availability is
-- member-only at the table level. The public signal comes from the
-- `public_vendor_availability` view in 0007.
create policy "vendor_availability: member all"
  on public.vendor_availability for all to authenticated
  using (public.vendor_can(vendor_id, 'availability.manage') or public.is_vendor_member(vendor_id))
  with check (public.vendor_can(vendor_id, 'availability.manage'));

create policy "vendor_metrics_daily: member read"
  on public.vendor_metrics_daily for select to authenticated
  using (public.vendor_can(vendor_id, 'analytics.view')
         or public.has_admin_permission('analytics.read'));
