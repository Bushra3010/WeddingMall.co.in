-- 0016  Newsletter subscribers.
--
-- Added so the footer signup is real. A form that accepts an address and
-- discards it is a dark pattern, and marketing consent has to be recorded
-- separately from transactional contact anyway (PRD 6.12, 14.3).

create table public.newsletter_subscribers (
  id             uuid primary key default extensions.gen_random_uuid(),
  email          text not null unique,
  user_id        uuid references public.profiles (id) on delete set null,
  source         text not null default 'footer',
  -- Marketing consent is explicit and separate from transactional email
  -- (PRD 6.12: "marketing consent is separate from transactional
  -- communication").
  consented      boolean not null default true,
  unsubscribed_at timestamptz,
  created_at     timestamptz not null default now()
);

create index newsletter_subscribers_active_idx
  on public.newsletter_subscribers (created_at desc) where unsubscribed_at is null;

alter table public.newsletter_subscribers enable row level security;

-- Anyone may subscribe; nobody may read the list back. An address list is PII,
-- and a public SELECT would turn the signup form into an email harvester.
create policy "newsletter_subscribers: public subscribe"
  on public.newsletter_subscribers for insert to anon, authenticated
  with check (consented = true and unsubscribed_at is null);

create policy "newsletter_subscribers: admin read"
  on public.newsletter_subscribers for select to authenticated
  using (public.has_admin_permission('cms.publish'));
