-- 0038  Payout bank details, and the cancelled cheque that backs them.
--
-- A marketplace that takes enquiries eventually has to pay somebody, and there
-- was nowhere to record who. Vendors were being asked for account details out
-- of band — over WhatsApp, in a spreadsheet — which is both the least auditable
-- place to keep them and the easiest to get wrong by a digit.
--
-- ## Shape
--
-- One account per business, so `vendor_id` is the primary key rather than a
-- foreign key with a `is_default` flag. Multiple accounts would need a rule for
-- which one a payout uses, and there is no payout engine yet to have an opinion.
-- Adding rows later is a wider primary key; guessing the rule now is a wrong
-- answer written into a constraint.
--
-- ## Who may read it
--
-- **Not** `listing.edit`. That capability belongs to `vendor_editor` — a
-- freelance photographer's assistant, a marketing agency — and it is the wrong
-- bar for "may redirect where this business's money goes". This is gated on
-- `billing.manage`, which `vendor_can()` grants to `vendor_owner` alone:
-- `vendor_manager` is explicitly excluded there, and everything below it more
-- so.
--
-- On the admin side, **not** `vendor.read` either. That is held by analysts,
-- content admins and support agents, none of whom have a reason to see an
-- account number. Bank details are readable by `billing.manage` (the people who
-- pay) and `vendor.verify` (the people who check the cheque against the name).
--
-- ## What is stored, and what is not
--
-- The account number is stored in full, because a payout needs all of it and a
-- vendor needs to be able to check the digits they typed. It never reaches a
-- public view: `public_vendors` (0007) is column-listed, `build_listing_snapshot`
-- (0011) reads named tables, and neither is touched here. The UI masks all but
-- the last four for admins and reveals the rest through an audited action, the
-- same shape as opening a verification document.
--
-- The cancelled cheque is **not** a new file mechanism. It goes into the
-- existing private `vendor-documents` bucket as a `vendor_documents` row with
-- `document_type = 'cancelled_cheque'`, so it inherits the signed-URL reads, the
-- audit entry on open, and the storage policies that are already probed. A
-- second private-file path would be a second thing to get wrong.

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_bank_accounts (
  vendor_id           uuid primary key references public.vendors (id) on delete cascade,
  account_holder_name text not null,
  account_number      text not null,
  -- Four letters, a zero, then six alphanumerics — the RBI's IFSC format. The
  -- constraint is here as well as in Zod because a service-role script and a
  -- future import path both bypass the application's validation.
  ifsc                text not null check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name           text,
  branch_name         text,
  account_type        text not null default 'savings'
                        check (account_type in ('savings', 'current')),
  upi_id              text,
  -- The cancelled cheque or passbook page. `on delete set null` rather than
  -- cascade: removing the image must not remove the account details it was
  -- uploaded to support.
  cheque_document_id  uuid references public.vendor_documents (id) on delete set null,
  verified_at         timestamptz,
  verified_by         uuid references public.profiles (id) on delete set null,
  verification_note   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (length(account_number) between 6 and 20),
  check (account_number ~ '^[0-9]+$')
);

comment on table public.vendor_bank_accounts is
  'Payout account for a business. Owner-only on the vendor side (billing.manage); billing.manage or vendor.verify on the admin side. Never public.';

drop trigger if exists vendor_bank_accounts_updated_at on public.vendor_bank_accounts;
create trigger vendor_bank_accounts_updated_at
  before update on public.vendor_bank_accounts
  for each row execute function public.set_updated_at();

alter table public.vendor_bank_accounts enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Policies
-- ---------------------------------------------------------------------------
-- Dropped first so the file can be replayed. `scripts/apply-migrations.mjs`
-- runs every migration in order rather than tracking what has been applied.

drop policy if exists "vendor_bank_accounts: owner read" on public.vendor_bank_accounts;
create policy "vendor_bank_accounts: owner read"
  on public.vendor_bank_accounts for select to authenticated
  using (
    public.vendor_can(vendor_id, 'billing.manage')
    or public.has_admin_permission('billing.manage')
    or public.has_admin_permission('vendor.verify')
  );

drop policy if exists "vendor_bank_accounts: owner write" on public.vendor_bank_accounts;
create policy "vendor_bank_accounts: owner write"
  on public.vendor_bank_accounts for insert to authenticated
  with check (public.vendor_can(vendor_id, 'billing.manage'));

-- An admin correcting a typo is a real support case, so the UPDATE grant covers
-- both. Which *columns* each may write is settled by the guard below, because
-- RLS is row-level and cannot express "everything except verified_at".
drop policy if exists "vendor_bank_accounts: owner update" on public.vendor_bank_accounts;
create policy "vendor_bank_accounts: owner update"
  on public.vendor_bank_accounts for update to authenticated
  using (
    public.vendor_can(vendor_id, 'billing.manage')
    or public.has_admin_permission('billing.manage')
  )
  with check (
    public.vendor_can(vendor_id, 'billing.manage')
    or public.has_admin_permission('billing.manage')
  );

drop policy if exists "vendor_bank_accounts: owner delete" on public.vendor_bank_accounts;
create policy "vendor_bank_accounts: owner delete"
  on public.vendor_bank_accounts for delete to authenticated
  using (public.vendor_can(vendor_id, 'billing.manage'));

-- ---------------------------------------------------------------------------
-- 3. A vendor cannot mark their own account verified
-- ---------------------------------------------------------------------------
-- Same lesson as 0018 (reviews), 0022 (vendor columns) and ADR-019: a policy
-- grants UPDATE on the whole row, so any column the row carries is writable by
-- anyone who may update it. Without this, the owner who may legitimately fix
-- their IFSC could also PATCH `verified_at` and wear a badge nobody issued.
--
-- SECURITY INVOKER for the reason 0022 gives: the legitimate writers are
-- SECURITY DEFINER functions and the service role, and `current_user` is the
-- only thing that can tell them apart from a browser.

create or replace function public.enforce_bank_account_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  from_client boolean := current_user in ('authenticated', 'anon');
begin
  if not from_client then
    return new;
  end if;

  if public.has_admin_permission('billing.manage')
     or public.has_admin_permission('vendor.verify') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.verified_at is not null or new.verified_by is not null then
      raise exception 'Bank verification is recorded by our team, not by the business.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.verified_at is distinct from old.verified_at
     or new.verified_by is distinct from old.verified_by
     or new.verification_note is distinct from old.verification_note then
    raise exception 'Bank verification is recorded by our team, not by the business.'
      using errcode = '42501';
  end if;

  -- Changing where the money goes invalidates the check that was done against
  -- the old details. Silently keeping the badge across an account change is
  -- exactly the gap someone would use.
  if new.account_number is distinct from old.account_number
     or new.ifsc is distinct from old.ifsc
     or new.account_holder_name is distinct from old.account_holder_name then
    new.verified_at := null;
    new.verified_by := null;
    new.verification_note := null;
  end if;

  return new;
end;
$$;

drop trigger if exists vendor_bank_accounts_guard on public.vendor_bank_accounts;
create trigger vendor_bank_accounts_guard
  before insert or update on public.vendor_bank_accounts
  for each row execute function public.enforce_bank_account_guard();

-- ---------------------------------------------------------------------------
-- 4. The cheque must belong to the same business
-- ---------------------------------------------------------------------------
-- `cheque_document_id` points at `vendor_documents`, which hangs off
-- `vendor_verifications` — so nothing in the foreign key says the document
-- belongs to *this* vendor. Without this check an owner could point their row
-- at another business's document id and, through a joined read, learn that it
-- exists. Cheap to enforce, and impossible to reason about later if it is not.

create or replace function public.enforce_bank_cheque_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc_vendor uuid;
begin
  if new.cheque_document_id is null then
    return new;
  end if;

  select v.vendor_id into doc_vendor
  from public.vendor_documents d
  join public.vendor_verifications v on v.id = d.verification_id
  where d.id = new.cheque_document_id;

  if doc_vendor is null or doc_vendor <> new.vendor_id then
    raise exception 'That document does not belong to this business.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists vendor_bank_accounts_cheque_owner on public.vendor_bank_accounts;
create trigger vendor_bank_accounts_cheque_owner
  before insert or update of cheque_document_id on public.vendor_bank_accounts
  for each row execute function public.enforce_bank_cheque_owner();
