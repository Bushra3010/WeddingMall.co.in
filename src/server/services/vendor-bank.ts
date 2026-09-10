import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ServiceError } from '@/lib/action-result'
import { assertVendorCapability, can, type Actor } from '@/lib/permissions'
import { logError } from '@/lib/observability/logger'
import { audit } from '@/lib/security/audit'
import { isMissingBankTable, readBankAccountRow } from '@/server/dal/vendor-bank'
import type { BankAccountInput } from '@/features/vendors/bank-schema'

/**
 * Payout bank details (migration 0038).
 *
 * Gated on `billing.manage`, which `vendor_can()` grants to `vendor_owner`
 * alone. Not `listing.edit`: the capability that lets a hired editor rewrite
 * the description is the wrong bar for changing where the business's money is
 * sent. RLS enforces the same rule; the assert here exists to produce a
 * sentence rather than a 42501 (CLAUDE.md invariant 2).
 */

const TABLE = 'vendor_bank_accounts'

/**
 * Writes only. The reads live in `dal/vendor-bank.ts` per CLAUDE.md, and the
 * masked summary a page receives is built there so the full account number
 * never becomes a Server Component prop.
 *
 * `vendor_bank_accounts` arrives with migration 0038 and is not in
 * `src/types/database.ts` until `npm run db:types` is run against a database
 * that has it. That file is generated and hand-editing it is forbidden
 * (CLAUDE.md invariant 4), so the client is cast here — narrowly, in one place.
 *
 * **Delete this once the types have been regenerated.** The cast is on the
 * client rather than on the method for the reason `deleteVendorAsAdmin`
 * documents: detaching `from` from its receiver breaks supabase-js, which reads
 * `this.rest` inside it.
 */
type BankWriteClient = {
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ) => Promise<{ error: { code?: string | null; message?: string | null } | null }>
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { code?: string | null; message?: string | null } | null }>
    }
  }
}

/**
 * The one refusal worth naming separately.
 *
 * Deploys and migrations are separate manual steps in this project, so "code
 * ahead of schema" is a real state rather than a hypothetical. A vendor who
 * types their account details into a form that answers "something went wrong"
 * will type them again; one who is told the feature is not switched on yet will
 * not. The operator gets the specific reason in the log.
 */
function notMigratedError(vendorId: string, error: unknown): ServiceError {
  logError('service.vendorBank.migration0038NotApplied', error, { vendorId })
  return new ServiceError(
    'unavailable',
    'Payout details are not switched on yet. Please try again shortly.',
  )
}

export async function saveBankAccount(actor: Actor, vendorId: string, input: BankAccountInput) {
  assertVendorCapability(actor, vendorId, 'billing.manage')

  const supabase = (await createClient()) as unknown as BankWriteClient

  /*
   * Upsert on the primary key. Deliberately *not* an insert-then-update pair:
   * the read that decides between them runs under RLS, and "no row visible" has
   * never meant "no row exists" in this codebase — that assumption broke vendor
   * sign-up once already (see `createVendorForUser`).
   *
   * `verified_at` is not in the payload and cannot be: the 0038 guard refuses a
   * client write to it, and clears it automatically when the account number,
   * IFSC or holder name changes. A verification checked against details that
   * have since been replaced is not a verification.
   */
  const { error } = await supabase.from(TABLE).upsert(
    {
      vendor_id: vendorId,
      account_holder_name: input.accountHolderName,
      account_number: input.accountNumber,
      ifsc: input.ifsc,
      bank_name: input.bankName || null,
      branch_name: input.branchName || null,
      account_type: input.accountType,
      upi_id: input.upiId || null,
    },
    { onConflict: 'vendor_id' },
  )

  if (error) {
    if (isMissingBankTable(error)) throw notMigratedError(vendorId, error)
    if (error.code === '42501') {
      throw new ServiceError(
        'forbidden',
        'Only the account owner can change payout details for this business.',
      )
    }
    // A CHECK constraint rejecting the IFSC or the account number. The message
    // is ours to write, not Postgres's — its version names the constraint.
    if (error.code === '23514') {
      throw new ServiceError(
        'validation_error',
        'Check the account number and IFSC — one of them is not in a valid format.',
      )
    }
    logError('service.saveBankAccount', error, { vendorId })
    throw new ServiceError('internal_error', 'We could not save those bank details.')
  }

  return { vendorId }
}

/** Attach an uploaded cancelled cheque to the account on file. */
export async function setChequeDocument(actor: Actor, vendorId: string, documentId: string | null) {
  assertVendorCapability(actor, vendorId, 'billing.manage')

  const supabase = (await createClient()) as unknown as BankWriteClient
  const { error } = await supabase
    .from(TABLE)
    .upsert({ vendor_id: vendorId, cheque_document_id: documentId }, { onConflict: 'vendor_id' })

  if (error) {
    if (isMissingBankTable(error)) throw notMigratedError(vendorId, error)
    // P0001 is the 0038 trigger refusing a document that belongs to another
    // business. Its message is written to be read.
    if (error.code === 'P0001') {
      throw new ServiceError('invalid_state', error.message ?? 'That document is not yours.')
    }
    /*
     * 23502 is a not-null violation, which here means the upsert reached a
     * vendor with no bank row yet: `account_holder_name`, `account_number` and
     * `ifsc` are all NOT NULL, and this payload carries none of them. The cheque
     * genuinely cannot be attached before the account exists, so it is worth
     * saying which order to do them in — the file itself is already stored and
     * appears under Documents either way.
     */
    if (error.code === '23502') {
      throw new ServiceError(
        'invalid_state',
        'The cheque was uploaded, but enter and save the account details first so it can be attached to them.',
      )
    }
    logError('service.setChequeDocument', error, { vendorId })
    throw new ServiceError('internal_error', 'We could not attach that cheque.')
  }

  return { vendorId }
}

export async function deleteBankAccount(actor: Actor, vendorId: string) {
  assertVendorCapability(actor, vendorId, 'billing.manage')

  const supabase = (await createClient()) as unknown as BankWriteClient
  const { error } = await supabase.from(TABLE).delete().eq('vendor_id', vendorId)

  if (error) {
    if (isMissingBankTable(error)) throw notMigratedError(vendorId, error)
    logError('service.deleteBankAccount', error, { vendorId })
    throw new ServiceError('internal_error', 'We could not remove those bank details.')
  }
  return { ok: true }
}

/**
 * The full account number, for an admin, recorded in the audit log.
 *
 * PRD 10.3 requires PII reveals to be audited, and a bank account number is the
 * most consequential piece of personal data this application holds. The admin
 * screen shows the masked form; this is what the Reveal button calls.
 *
 * The permission check is here rather than left to RLS because the message
 * matters — and because an audit entry must not be written for a read that was
 * then refused.
 */
export async function revealBankAccount(actor: Actor, vendorId: string, requestId?: string) {
  if (!can(actor, 'billing.manage') && !can(actor, 'vendor.verify')) {
    throw new ServiceError(
      'forbidden',
      'Revealing bank details requires the billing.manage or vendor.verify permission.',
    )
  }

  const row = await readBankAccountRow(vendorId)
  if (!row) throw new ServiceError('not_found', 'No bank details are on file for this business.')

  await audit({
    action: 'pii.reveal',
    entityType: 'vendor_bank_account',
    entityId: vendorId,
    actorUserId: actor.userId,
    after: { field: 'account_number' },
    requestId: requestId ?? null,
  })

  return { accountNumber: row.account_number, ifsc: row.ifsc }
}
