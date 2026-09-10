-- 0040  An admin can add verification documents and payout details.
--
-- Reported from the admin panel: on `/admin/vendors/<id>` both of these were
-- read-only. "Verification documents" could be opened and never added, and
-- "Payout details" said *Only the business owner can add them* — which was true
-- of the schema and useless in practice. Businesses here are signed up over the
-- phone and at wedding fairs (see 0039); the person holding the GST certificate
-- and the cancelled cheque is an admin sitting beside the owner, and the
-- fallback was WhatsApp, which is exactly what 0038 was written to stop.
--
-- Nothing here widens who may *read* anything. Every policy below already
-- admitted an admin on the read side; the gap was entirely on insert and delete.
--
-- ## Which permission for which table
--
-- Documents: `vendor.verify` — the permission that already reads them, held by
-- `vendor_verifier` and `operations_admin`. A support agent or an analyst holds
-- `vendor.read` and still sees nothing.
--
-- Payout details: `billing.manage` — the permission 0038 already granted the
-- UPDATE to, held by `finance_admin` alone (plus `super_admin`). Deliberately
-- **not** `vendor.verify`: a verifier may look at an account number to check it
-- against a cheque, which is why it reads; changing where money is sent is the
-- finance desk's job. Read stays as 0038 left it.

-- ---------------------------------------------------------------------------
-- 1. Verification records and documents
-- ---------------------------------------------------------------------------
-- The originals are in 0004 (`member submit`, `member insert`) and 0008
-- (`member delete`). Dropped and recreated rather than edited in place, because
-- an applied migration is never edited (CLAUDE.md invariant 4) and
-- `scripts/apply-migrations.mjs` replays files in order, so this one must be
-- safe to run twice.

drop policy if exists "vendor_verifications: member submit" on public.vendor_verifications;
create policy "vendor_verifications: member submit"
  on public.vendor_verifications for insert to authenticated
  with check (
    public.vendor_can(vendor_id, 'team.manage')
    or public.has_admin_permission('vendor.verify')
  );

drop policy if exists "vendor_documents: member insert" on public.vendor_documents;
create policy "vendor_documents: member insert"
  on public.vendor_documents for insert to authenticated
  with check (exists (
    select 1 from public.vendor_verifications v
    where v.id = verification_id
      and (public.vendor_can(v.vendor_id, 'team.manage')
           or public.has_admin_permission('vendor.verify'))
  ));

drop policy if exists "vendor_documents: member delete" on public.vendor_documents;
create policy "vendor_documents: member delete"
  on public.vendor_documents for delete to authenticated
  using (exists (
    select 1 from public.vendor_verifications v
    where v.id = verification_id
      and (public.vendor_can(v.vendor_id, 'team.manage')
           or public.has_admin_permission('vendor.verify'))
  ));

-- ---------------------------------------------------------------------------
-- 2. Payout details
-- ---------------------------------------------------------------------------
-- 0038 gave the admin side UPDATE and nothing else, which is a half-open door:
-- an admin could correct a typo in an account that existed and could not enter
-- the first one, and could not remove a wrong account at all. All three are the
-- same support case.

drop policy if exists "vendor_bank_accounts: owner write" on public.vendor_bank_accounts;
create policy "vendor_bank_accounts: owner write"
  on public.vendor_bank_accounts for insert to authenticated
  with check (
    public.vendor_can(vendor_id, 'billing.manage')
    or public.has_admin_permission('billing.manage')
  );

drop policy if exists "vendor_bank_accounts: owner delete" on public.vendor_bank_accounts;
create policy "vendor_bank_accounts: owner delete"
  on public.vendor_bank_accounts for delete to authenticated
  using (
    public.vendor_can(vendor_id, 'billing.manage')
    or public.has_admin_permission('billing.manage')
  );

-- ---------------------------------------------------------------------------
-- 3. Changing the account still clears the verification — for admins too
-- ---------------------------------------------------------------------------
-- 0038's guard returns early for an admin, so every rule after that point was
-- skipped for them. Two of those rules are the admin's to break: `verified_at`,
-- `verified_by` and `verification_note` are recorded by our team, and that is
-- who they are. The third is not.
--
-- "Changing the account number, IFSC or holder name clears the verification"
-- exists because a check made against details that have since been replaced is
-- not a check, and that is true no matter who did the replacing. The branch was
-- unreachable until now — no admin write path existed — so this is closing it
-- before the first one ships rather than after.
--
-- The clear is skipped when the same statement sets `verified_at` itself, so an
-- admin who corrects an account *and* records the check in one go keeps it.
-- Without that, the only way to verify an account would be a second write.

create or replace function public.enforce_bank_account_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  from_client boolean := current_user in ('authenticated', 'anon');
  is_staff    boolean;
begin
  if not from_client then
    return new;
  end if;

  is_staff := public.has_admin_permission('billing.manage')
              or public.has_admin_permission('vendor.verify');

  if tg_op = 'INSERT' then
    if not is_staff and (new.verified_at is not null or new.verified_by is not null) then
      raise exception 'Bank verification is recorded by our team, not by the business.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if not is_staff
     and (new.verified_at is distinct from old.verified_at
          or new.verified_by is distinct from old.verified_by
          or new.verification_note is distinct from old.verification_note) then
    raise exception 'Bank verification is recorded by our team, not by the business.'
      using errcode = '42501';
  end if;

  if (new.account_number is distinct from old.account_number
      or new.ifsc is distinct from old.ifsc
      or new.account_holder_name is distinct from old.account_holder_name)
     and new.verified_at is not distinct from old.verified_at then
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

comment on function public.enforce_bank_account_guard() is
  'Verification columns are staff-only; changing the account identity clears the verification, including when an admin does it (0040).';
