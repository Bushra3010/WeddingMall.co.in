import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'
import { maskAccountNumber } from '@/features/vendors/bank-schema'

/**
 * Reads for `vendor_bank_accounts` (migration 0038).
 *
 * Reads live here rather than in `services/vendor-bank.ts` per CLAUDE.md — the
 * service owns the writes and the permission messages, the DAL owns the query.
 *
 * ## Why the summary never carries the account number
 *
 * A Server Component's props are serialised into the HTML it sends. So a page
 * that reads the full account number in order to mask it in the markup has
 * already shipped the number to the browser, and "masked" describes only what
 * is painted — View Source shows all of it, with no audit entry.
 *
 * {@link getBankAccountSummary} therefore masks **on the server** and returns
 * only the masked form. The full number is reachable exactly once, through
 * `revealBankAccount()`, which writes a `pii.reveal` audit row first. That is
 * the same shape as opening a verification document.
 */

/** The full row. Not exported to pages — see the note above. */
export interface BankAccountRow {
  vendor_id: string
  account_holder_name: string
  account_number: string
  ifsc: string
  bank_name: string | null
  branch_name: string | null
  account_type: string
  upi_id: string | null
  cheque_document_id: string | null
  verified_at: string | null
  verified_by: string | null
  verification_note: string | null
  updated_at: string
}

/** What a screen may hold: everything except the digits that move money. */
export interface BankAccountSummary {
  vendorId: string
  accountHolderName: string
  /** `••••••3456`. The only form of the number that reaches a page. */
  accountNumberMasked: string
  ifsc: string
  bankName: string | null
  branchName: string | null
  accountType: string
  upiId: string | null
  chequeDocumentId: string | null
  verifiedAt: string | null
  verificationNote: string | null
  updatedAt: string
}

const SELECT =
  'vendor_id, account_holder_name, account_number, ifsc, bank_name, branch_name, account_type, upi_id, cheque_document_id, verified_at, verified_by, verification_note, updated_at'

/**
 * `vendor_bank_accounts` arrives with migration 0038 and is absent from
 * `src/types/database.ts` until `npm run db:types` runs against a database that
 * has it. That file is generated and hand-editing it is forbidden (CLAUDE.md
 * invariant 4), so the client is cast here — narrowly, and typed on the way out
 * so every call site stays checked.
 *
 * The cast is on the **client**, not on the method, for the reason
 * `deleteVendorAsAdmin` documents at length: detaching `from` from its receiver
 * breaks supabase-js, which reads `this.rest` inside it.
 *
 * **Delete this once the types have been regenerated.**
 */
type BankReadClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: BankAccountRow | null
          error: { code?: string | null; message?: string | null } | null
        }>
      }
    }
  }
}

/**
 * True when the failure is "migration 0038 has not been applied here".
 *
 * `42P01` is Postgres's undefined_table; `PGRST205` is PostgREST reporting the
 * same thing from its schema cache. Worth telling apart from a real fault: one
 * is a deployment that is ahead of its schema, which is a normal state in this
 * project (see the 0035 note in STATUS.md), and the other is a bug.
 */
export function isMissingBankTable(error: { code?: string | null } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

/**
 * The full row, for the one caller allowed to see it.
 *
 * Returns `null` both for a vendor that has entered nothing *and* for a caller
 * RLS will not show the row to — through a policy those two are the same answer
 * by design. A caller that needs to tell them apart must check the capability
 * itself first, which `revealBankAccount()` does.
 */
export async function readBankAccountRow(vendorId: string): Promise<BankAccountRow | null> {
  try {
    const supabase = (await createClient()) as unknown as BankReadClient
    const { data, error } = await supabase
      .from('vendor_bank_accounts')
      .select(SELECT)
      .eq('vendor_id', vendorId)
      .maybeSingle()

    if (error) {
      // Not an error worth a stack trace: the code is simply ahead of the
      // schema. Logged at all so it is visible why the section reads as empty.
      if (isMissingBankTable(error)) {
        logError('dal.readBankAccountRow.migrationNotApplied', error, { vendorId })
        return null
      }
      throw error
    }
    return data
  } catch (error) {
    logError('dal.readBankAccountRow', error, { vendorId })
    return null
  }
}

/** The masked view. This is what pages and components receive. */
export async function getBankAccountSummary(vendorId: string): Promise<BankAccountSummary | null> {
  const row = await readBankAccountRow(vendorId)
  if (!row) return null

  return {
    vendorId: row.vendor_id,
    accountHolderName: row.account_holder_name,
    accountNumberMasked: maskAccountNumber(row.account_number),
    ifsc: row.ifsc,
    bankName: row.bank_name,
    branchName: row.branch_name,
    accountType: row.account_type,
    upiId: row.upi_id,
    chequeDocumentId: row.cheque_document_id,
    verifiedAt: row.verified_at,
    verificationNote: row.verification_note,
    updatedAt: row.updated_at,
  }
}
