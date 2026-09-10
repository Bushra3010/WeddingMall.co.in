'use server'

import { revalidatePath } from 'next/cache'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { getActor } from '@/server/dal/actor'
import { bankAccountSchema } from '@/features/vendors/bank-schema'
import {
  deleteBankAccount,
  revealBankAccount,
  saveBankAccount,
  setChequeDocument,
} from '@/server/services/vendor-bank'
import { uploadVerificationDocument } from '@/server/services/verification'
import { getDocumentIdByStoragePath } from '@/server/dal/vendor-workspace'

/**
 * Payout bank details and the cancelled cheque that backs them.
 *
 * Separate from `actions.ts` because this file's capability is different from
 * everything in it: `billing.manage`, not `listing.edit`. Keeping them apart
 * makes the gate visible in the import rather than buried per-function.
 */

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const vendorId = (form: FormData) => str(form, 'vendorId')

export async function saveBankAccountAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ vendorId: string }>> {
  const result = await runAction('vendor.saveBankAccount', async () => {
    const actor = await getActor()
    const input = bankAccountSchema.parse({
      accountHolderName: str(form, 'accountHolderName'),
      accountNumber: str(form, 'accountNumber'),
      confirmAccountNumber: str(form, 'confirmAccountNumber'),
      ifsc: str(form, 'ifsc'),
      bankName: str(form, 'bankName'),
      branchName: str(form, 'branchName'),
      accountType: str(form, 'accountType') || 'savings',
      upiId: str(form, 'upiId'),
    })

    return saveBankAccount(actor, vendorId(form), input)
  })

  if (result.ok) {
    revalidatePath('/vendor-dashboard/list')
    // The wizard renders on both of these, so a save from one must not
    // leave the other showing the details it replaced.
    revalidatePath('/vendor-dashboard/listing')
    revalidatePath('/vendor-dashboard/settings')
  }
  return result
}

/**
 * The cancelled cheque.
 *
 * Uploaded through `uploadVerificationDocument` rather than a new file path, so
 * it lands in the private `vendor-documents` bucket with the same MIME and size
 * validation, the same `<vendorId>/…` object prefix, and the same signed-URL
 * reads that are already probed. Then the returned document is attached to the
 * bank row.
 *
 * Two capabilities, deliberately. The upload asks for `team.manage` because
 * that is what every other verification document requires and the storage policy
 * is written against it; attaching it to the payout account asks for
 * `billing.manage`. A manager may therefore add the image, and only the owner
 * can make it the cheque of record.
 */
export async function uploadChequeAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ path: string; attached: boolean; reason: string | null }>> {
  const result = await runAction('vendor.uploadCheque', async () => {
    const actor = await getActor()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      throw new ServiceError('invalid_file', 'Choose a photo or PDF of the cancelled cheque.')
    }

    const target = vendorId(form)
    const uploaded = await uploadVerificationDocument(actor, target, file, 'cancelled_cheque')

    /*
     * `uploadVerificationDocument` returns the storage path, not the row id, so
     * the document is looked up by that path. Paths carry a UUID generated at
     * upload time and the bucket refuses `upsert`, so it identifies exactly one
     * row.
     */
    const documentId = await getDocumentIdByStoragePath(uploaded.path)

    /*
     * The file is stored and its `vendor_documents` row is written either way.
     * Attaching it to the payout account is the step that can still fail — the
     * account row may not exist yet, or the caller may hold `team.manage`
     * without `billing.manage` (a manager may add the image; only the owner
     * makes it the cheque of record). Neither is a reason to report the upload
     * as failed, so the outcome of the attach is returned rather than thrown.
     */
    if (!documentId) {
      return { ...uploaded, attached: false, reason: null as string | null }
    }

    try {
      await setChequeDocument(actor, target, documentId)
      return { ...uploaded, attached: true, reason: null as string | null }
    } catch (error) {
      // Reported, not swallowed. `setChequeDocument` writes messages meant to be
      // read ("save the account details first so it can be attached"), and a
      // vendor who is told only "uploaded" will not know to come back.
      const reason = error instanceof ServiceError ? error.message : null
      return { ...uploaded, attached: false, reason }
    }
  })

  if (result.ok) {
    revalidatePath('/vendor-dashboard/list')
    // The wizard renders on both of these, so a save from one must not
    // leave the other showing the details it replaced.
    revalidatePath('/vendor-dashboard/listing')
    revalidatePath('/vendor-dashboard/settings')
  }
  return result
}

export async function deleteBankAccountAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('vendor.deleteBankAccount', async () => {
    const actor = await getActor()
    return deleteBankAccount(actor, vendorId(form))
  })

  if (result.ok) {
    revalidatePath('/vendor-dashboard/list')
    // The wizard renders on both of these, so a save from one must not
    // leave the other showing the details it replaced.
    revalidatePath('/vendor-dashboard/listing')
    revalidatePath('/vendor-dashboard/settings')
  }
  return result
}

/**
 * Reveal the full account number to an admin.
 *
 * Takes an id rather than FormData because it is called from a click handler,
 * matching `openDocumentAction`. The audit entry is written inside the service,
 * before the value is returned, so a reveal cannot happen without a record of
 * it.
 */
export async function revealBankAccountAction(
  targetVendorId: string,
): Promise<ActionResult<{ accountNumber: string; ifsc: string }>> {
  return runAction('admin.revealBankAccount', async (requestId) => {
    const actor = await getActor()
    return revealBankAccount(actor, targetVendorId, requestId)
  })
}
