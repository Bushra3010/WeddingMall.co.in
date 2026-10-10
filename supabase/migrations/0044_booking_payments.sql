-- 0044  Optional online advance on a booking (Razorpay).
--
-- A booking ("Book now") needs no payment. For categories that offer it (wedding
-- cars first), the customer may choose to pay an advance of any amount they
-- like. This table records each attempt.
--
-- ## Who may write what
--
-- The customer creates the row, through their own session, at status
-- `created` and only for an enquiry that is theirs. They can never move it to
-- `paid`: there is no customer UPDATE policy at all. A payment becomes `paid`
-- only in the Razorpay webhook handler, after the HMAC signature is verified,
-- through the service-role client (CLAUDE.md invariant 1 — webhooks). So a
-- customer calling PostgREST directly cannot mark an unpaid advance as paid.
--
-- Money is integer minor units (paise) + ISO currency (invariant 5).

create table if not exists public.booking_payments (
  id                  uuid primary key default extensions.gen_random_uuid(),
  enquiry_id          uuid not null references public.enquiries (id) on delete cascade,
  customer_id         uuid not null references public.profiles (id) on delete cascade,
  vendor_id           uuid not null references public.vendors (id) on delete cascade,
  amount_minor        integer not null check (amount_minor >= 100 and amount_minor <= 10000000),
  currency            text not null default 'INR' check (currency = 'INR'),
  provider            text not null default 'razorpay' check (provider = 'razorpay'),
  provider_order_id   text not null unique,
  provider_payment_id text unique,
  status              text not null default 'created'
                        check (status in ('created', 'paid', 'failed')),
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);

create index if not exists booking_payments_enquiry_idx on public.booking_payments (enquiry_id);
create index if not exists booking_payments_vendor_idx on public.booking_payments (vendor_id);

alter table public.booking_payments enable row level security;

-- The customer reads their own payments.
drop policy if exists "booking_payments: customer read" on public.booking_payments;
create policy "booking_payments: customer read"
  on public.booking_payments for select to authenticated
  using (customer_id = auth.uid());

-- The customer starts a payment: own row, own enquiry, matching vendor, and
-- only ever as `created` with no provider payment id attached.
drop policy if exists "booking_payments: customer create" on public.booking_payments;
create policy "booking_payments: customer create"
  on public.booking_payments for insert to authenticated
  with check (
    customer_id = auth.uid()
    and status = 'created'
    and provider_payment_id is null
    and paid_at is null
    and exists (
      select 1 from public.enquiries e
      where e.id = enquiry_id and e.customer_id = auth.uid() and e.vendor_id = booking_payments.vendor_id
    )
  );

-- The vendor's members see payments made to their business.
drop policy if exists "booking_payments: vendor read" on public.booking_payments;
create policy "booking_payments: vendor read"
  on public.booking_payments for select to authenticated
  using (public.is_vendor_member(vendor_id));

-- Admins with payment visibility.
drop policy if exists "booking_payments: admin read" on public.booking_payments;
create policy "booking_payments: admin read"
  on public.booking_payments for select to authenticated
  using (public.has_admin_permission('lead.read') or public.has_admin_permission('billing.manage'));

-- No UPDATE or DELETE policy for anyone: `paid` is written only by the webhook
-- through the service role, which bypasses RLS.
