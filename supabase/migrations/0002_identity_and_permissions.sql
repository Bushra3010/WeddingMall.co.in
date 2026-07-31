-- 0002  Identity, consent, and the admin permission catalogue.
-- PRD 9.1, 4.4, 10.2.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  avatar_path   text,
  phone         text,
  phone_verified_at timestamptz,
  locale        text not null default 'en-IN',
  timezone      text not null default 'Asia/Kolkata',
  status        public.profile_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Profile row is created by trigger, never by client input.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_path)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- consent
-- ---------------------------------------------------------------------------

create table public.user_consents (
  id             uuid primary key default extensions.gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  consent_type   text not null,
  policy_version text not null,
  granted        boolean not null,
  source         text,
  created_at     timestamptz not null default now()
);

create index user_consents_user_idx on public.user_consents (user_id, consent_type, created_at desc);

-- ---------------------------------------------------------------------------
-- admin roles and permissions
-- ---------------------------------------------------------------------------

create table public.admin_roles (
  id   uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table public.admin_permissions (
  id          uuid primary key default extensions.gen_random_uuid(),
  code        text not null unique,
  description text
);

create table public.admin_role_permissions (
  role_id       uuid not null references public.admin_roles (id) on delete cascade,
  permission_id uuid not null references public.admin_permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.admin_memberships (
  id         uuid primary key default extensions.gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role_id    uuid not null references public.admin_roles (id) on delete restrict,
  status     public.membership_status not null default 'invited',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role_id)
);

create trigger admin_memberships_updated_at
  before update on public.admin_memberships
  for each row execute function public.set_updated_at();

create index admin_memberships_user_idx on public.admin_memberships (user_id) where status = 'active';

insert into public.admin_roles (code, name) values
  ('super_admin',      'Super admin'),
  ('operations_admin', 'Operations admin'),
  ('vendor_verifier',  'Vendor verifier'),
  ('content_admin',    'Content admin'),
  ('support_agent',    'Support agent'),
  ('finance_admin',    'Finance admin'),
  ('analyst',          'Analyst');

insert into public.admin_permissions (code, description) values
  ('vendor.read',      'View vendor accounts and listings'),
  ('vendor.verify',    'Decide vendor verification'),
  ('vendor.suspend',   'Suspend or reactivate a vendor'),
  ('listing.moderate', 'Approve, reject, or request listing changes'),
  ('lead.read',        'Inspect enquiries and their timelines'),
  ('lead.assign',      'Assign or reassign a lead owner'),
  ('lead.export',      'Export lead data'),
  ('review.moderate',  'Moderate reviews and vendor responses'),
  ('cms.publish',      'Publish pages, posts, and homepage content'),
  ('billing.manage',   'Manage plans, subscriptions, and payments'),
  ('user.support',     'Perform support actions on customer accounts'),
  ('analytics.read',   'View platform analytics and reports'),
  ('admin.manage',     'Manage admin users, roles, and permissions');

-- Mirrors src/lib/permissions/catalogue.ts. Keep both in step.
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on true
where r.code = 'super_admin';

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p
  on p.code in ('vendor.read','vendor.verify','vendor.suspend','listing.moderate',
                'lead.read','lead.assign','review.moderate','analytics.read')
where r.code = 'operations_admin';

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p
  on p.code in ('vendor.read','vendor.verify','listing.moderate')
where r.code = 'vendor_verifier';

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.code in ('cms.publish','vendor.read','analytics.read')
where r.code = 'content_admin';

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.code in ('vendor.read','lead.read','user.support')
where r.code = 'support_agent';

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.code in ('vendor.read','billing.manage','analytics.read')
where r.code = 'finance_admin';

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.code in ('analytics.read','vendor.read')
where r.code = 'analyst';

-- ---------------------------------------------------------------------------
-- Authorisation helpers used by every RLS policy.
--
-- SECURITY DEFINER with a pinned empty search_path, and marked STABLE so the
-- planner caches the result per statement. These read membership tables that
-- the caller cannot read directly, which is what stops policy recursion.
-- ---------------------------------------------------------------------------

create or replace function public.has_admin_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_memberships m
    join public.admin_role_permissions rp on rp.role_id = m.role_id
    join public.admin_permissions p on p.id = rp.permission_id
    where m.user_id = (select auth.uid())
      and m.status = 'active'
      and p.code = permission_code
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

revoke execute on function public.has_admin_permission(text) from public;
revoke execute on function public.is_admin() from public;
grant execute on function public.has_admin_permission(text) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.user_consents         enable row level security;
alter table public.admin_roles           enable row level security;
alter table public.admin_permissions     enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_memberships     enable row level security;

create policy "profiles: own row read"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or public.has_admin_permission('user.support'));

create policy "profiles: own row update"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "user_consents: own read"
  on public.user_consents for select to authenticated
  using ((select auth.uid()) = user_id or public.has_admin_permission('user.support'));

create policy "user_consents: own insert"
  on public.user_consents for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Consent records are an audit trail: never updated or deleted by users.

create policy "admin_roles: admin read"
  on public.admin_roles for select to authenticated
  using (public.is_admin());

create policy "admin_permissions: admin read"
  on public.admin_permissions for select to authenticated
  using (public.is_admin());

create policy "admin_role_permissions: admin read"
  on public.admin_role_permissions for select to authenticated
  using (public.is_admin());

create policy "admin_memberships: own or manage read"
  on public.admin_memberships for select to authenticated
  using ((select auth.uid()) = user_id or public.has_admin_permission('admin.manage'));

-- No insert/update/delete policy for admin_memberships: elevation happens only
-- through a service-role job with an audit entry (PRD Epic E — the super_admin
-- role cannot be created through public input).
