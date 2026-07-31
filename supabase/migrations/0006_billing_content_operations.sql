-- 0006  Plans, subscriptions, payments, CMS, notifications, audit, analytics.
-- PRD 9.5, 6.10-6.12, 10.3, 13.

create table public.plans (
  id                uuid primary key default extensions.gen_random_uuid(),
  code              text not null unique,
  name              text not null,
  billing_interval  text not null check (billing_interval in ('monthly','yearly')),
  amount_minor      bigint not null check (amount_minor >= 0),
  currency          char(3) not null default 'INR',
  entitlements_json jsonb not null default '{}'::jsonb,
  trial_days        integer not null default 0 check (trial_days >= 0),
  active            boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.vendors
  add constraint vendors_plan_fk foreign key (plan_id) references public.plans (id)
  on delete set null;

create table public.subscriptions (
  id                       uuid primary key default extensions.gen_random_uuid(),
  vendor_id                uuid not null references public.vendors (id) on delete cascade,
  plan_id                  uuid not null references public.plans (id) on delete restrict,
  provider                 text not null default 'manual',
  provider_customer_id     text,
  provider_subscription_id text,
  status                   public.subscription_status not null default 'trialing',
  period_start             timestamptz,
  period_end               timestamptz,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create index subscriptions_vendor_idx on public.subscriptions (vendor_id, created_at desc);
create unique index subscriptions_provider_idx
  on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

create table public.payments (
  id                  uuid primary key default extensions.gen_random_uuid(),
  vendor_id           uuid not null references public.vendors (id) on delete restrict,
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  provider            text not null default 'manual',
  provider_payment_id text,
  amount_minor        bigint not null check (amount_minor >= 0),
  currency            char(3) not null default 'INR',
  status              text not null default 'pending'
                        check (status in ('pending','succeeded','failed','refunded')),
  paid_at             timestamptz,
  metadata_json       jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create unique index payments_provider_idx
  on public.payments (provider, provider_payment_id) where provider_payment_id is not null;

-- Webhook idempotency ledger (PRD 6.10, Epic F).
create table public.webhook_events (
  id                uuid primary key default extensions.gen_random_uuid(),
  provider          text not null,
  external_event_id text not null,
  type              text,
  payload_hash      text,
  status            text not null default 'received'
                      check (status in ('received','processed','failed','ignored')),
  attempts          integer not null default 0,
  error             text,
  processed_at      timestamptz,
  created_at        timestamptz not null default now(),
  unique (provider, external_event_id)
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create table public.notification_templates (
  id         uuid primary key default extensions.gen_random_uuid(),
  code       text not null,
  channel    public.notification_channel not null,
  locale     text not null default 'en-IN',
  subject    text,
  body       text not null,
  version    integer not null default 1,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (code, channel, locale, version)
);

create table public.notifications (
  id                  uuid primary key default extensions.gen_random_uuid(),
  user_id             uuid references public.profiles (id) on delete cascade,
  code                text not null,
  channel             public.notification_channel not null,
  payload_json        jsonb not null default '{}'::jsonb,
  status              text not null default 'queued'
                        check (status in ('queued','sent','failed','cancelled','read')),
  scheduled_at        timestamptz not null default now(),
  sent_at             timestamptz,
  read_at             timestamptz,
  provider_message_id text,
  attempts            integer not null default 0,
  error               text,
  created_at          timestamptz not null default now()
);

create index notifications_queue_idx on public.notifications (status, scheduled_at);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.notification_preferences (
  user_id            uuid not null references public.profiles (id) on delete cascade,
  channel            public.notification_channel not null,
  notification_group text not null,
  enabled            boolean not null default true,
  primary key (user_id, channel, notification_group)
);

-- ---------------------------------------------------------------------------
-- CMS
-- ---------------------------------------------------------------------------

create table public.pages (
  id               uuid primary key default extensions.gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  body             text,
  status           public.content_status not null default 'draft',
  seo_title        text,
  seo_description  text,
  canonical_url    text,
  og_image_path    text,
  published_at     timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  updated_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger pages_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

create table public.posts (
  id              uuid primary key default extensions.gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  excerpt         text,
  body            text,
  cover_path      text,
  author_id       uuid references public.profiles (id) on delete set null,
  category        text,
  status          public.content_status not null default 'draft',
  seo_title       text,
  seo_description text,
  canonical_url   text,
  og_image_path   text,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create index posts_published_idx on public.posts (status, published_at desc);

create table public.faqs (
  id         uuid primary key default extensions.gen_random_uuid(),
  scope      text not null default 'global'
               check (scope in ('global','category','city','vendor','page')),
  scope_id   uuid,
  question   text not null,
  answer     text not null,
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index faqs_scope_idx on public.faqs (scope, scope_id) where active;

create table public.homepage_sections (
  id          uuid primary key default extensions.gen_random_uuid(),
  code        text not null unique,
  title       text,
  config_json jsonb not null default '{}'::jsonb,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);

create trigger homepage_sections_updated_at
  before update on public.homepage_sections
  for each row execute function public.set_updated_at();

create table public.testimonials (
  id           uuid primary key default extensions.gen_random_uuid(),
  author_name  text not null,
  author_city  text,
  body         text not null,
  avatar_path  text,
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- operations
-- ---------------------------------------------------------------------------

create table public.support_tickets (
  id               uuid primary key default extensions.gen_random_uuid(),
  user_id          uuid references public.profiles (id) on delete set null,
  vendor_id        uuid references public.vendors (id) on delete set null,
  enquiry_id       uuid references public.enquiries (id) on delete set null,
  type             text not null,
  priority         text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status           text not null default 'open' check (status in ('open','pending','resolved','closed')),
  subject          text,
  body             text,
  assigned_admin_id uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- Immutable audit trail. No update or delete policy exists for this table, and
-- writes go through the service-role client only (PRD 10.3).
create table public.audit_logs (
  id            uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_type    public.actor_type not null default 'admin',
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  before_json   jsonb,
  after_json    jsonb,
  reason        text,
  ip_hash       text,
  request_id    text,
  created_at    timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);

create table public.analytics_events (
  id            uuid primary key default extensions.gen_random_uuid(),
  anonymous_id  text,
  user_id       uuid references public.profiles (id) on delete set null,
  session_id    text,
  name          text not null,
  entity_type   text,
  entity_id     uuid,
  properties_json jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);

create index analytics_events_name_idx on public.analytics_events (name, occurred_at desc);

create table public.data_requests (
  id           uuid primary key default extensions.gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type         text not null check (type in ('export','deletion')),
  status       text not null default 'requested'
                 check (status in ('requested','processing','completed','rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  notes        text
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.plans                    enable row level security;
alter table public.subscriptions            enable row level security;
alter table public.payments                 enable row level security;
alter table public.webhook_events           enable row level security;
alter table public.notification_templates   enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.pages                    enable row level security;
alter table public.posts                    enable row level security;
alter table public.faqs                     enable row level security;
alter table public.homepage_sections        enable row level security;
alter table public.testimonials             enable row level security;
alter table public.support_tickets          enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.analytics_events         enable row level security;
alter table public.data_requests            enable row level security;

create policy "plans: public read active"
  on public.plans for select to anon, authenticated using (active);
create policy "plans: finance write"
  on public.plans for all to authenticated
  using (public.has_admin_permission('billing.manage'))
  with check (public.has_admin_permission('billing.manage'));

create policy "subscriptions: vendor read"
  on public.subscriptions for select to authenticated
  using (public.is_vendor_member(vendor_id) or public.has_admin_permission('billing.manage'));

create policy "payments: vendor read"
  on public.payments for select to authenticated
  using (public.vendor_can(vendor_id, 'billing.manage')
         or public.has_admin_permission('billing.manage'));

-- webhook_events: service role only. No policy, RLS on = deny all.

create policy "notification_templates: admin read"
  on public.notification_templates for select to authenticated
  using (public.has_admin_permission('cms.publish'));

create policy "notifications: own read"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: own mark read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notification_preferences: own all"
  on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "pages: public read published"
  on public.pages for select to anon, authenticated using (status = 'published');
create policy "pages: cms write"
  on public.pages for all to authenticated
  using (public.has_admin_permission('cms.publish'))
  with check (public.has_admin_permission('cms.publish'));

create policy "posts: public read published"
  on public.posts for select to anon, authenticated using (status = 'published');
create policy "posts: cms write"
  on public.posts for all to authenticated
  using (public.has_admin_permission('cms.publish'))
  with check (public.has_admin_permission('cms.publish'));

create policy "faqs: public read active"
  on public.faqs for select to anon, authenticated using (active);
create policy "faqs: cms write"
  on public.faqs for all to authenticated
  using (public.has_admin_permission('cms.publish'))
  with check (public.has_admin_permission('cms.publish'));

create policy "homepage_sections: public read active"
  on public.homepage_sections for select to anon, authenticated using (active);
create policy "homepage_sections: cms write"
  on public.homepage_sections for all to authenticated
  using (public.has_admin_permission('cms.publish'))
  with check (public.has_admin_permission('cms.publish'));

create policy "testimonials: public read active"
  on public.testimonials for select to anon, authenticated using (active);
create policy "testimonials: cms write"
  on public.testimonials for all to authenticated
  using (public.has_admin_permission('cms.publish'))
  with check (public.has_admin_permission('cms.publish'));

create policy "support_tickets: own read"
  on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or public.has_admin_permission('user.support'));
create policy "support_tickets: own create"
  on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "audit_logs: audit permission read"
  on public.audit_logs for select to authenticated
  using (public.has_admin_permission('admin.manage'));

-- analytics_events: insert-only from the client, never readable by it.
create policy "analytics_events: anyone insert"
  on public.analytics_events for insert to anon, authenticated with check (true);
create policy "analytics_events: analyst read"
  on public.analytics_events for select to authenticated
  using (public.has_admin_permission('analytics.read'));

create policy "data_requests: own all"
  on public.data_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.has_admin_permission('user.support'));
create policy "data_requests: own create"
  on public.data_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
