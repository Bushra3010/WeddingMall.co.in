'use server'

import { revalidatePath } from 'next/cache'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { getActor } from '@/server/dal/actor'
import { bankAccountSchema } from '@/features/vendors/bank-schema'
import { CANCELLED_CHEQUE, adminUploadDocumentSchema } from '@/features/admin/vendor-documents'
import {
  deleteVerificationDocument,
  uploadVerificationDocument,
} from '@/server/services/verification'
import {
  deleteBankAccount,
  saveBankAccount,
  setChequeDocument,
} from '@/server/services/vendor-bank'
import { getDocumentIdByStoragePath } from '@/server/dal/vendor-workspace'

/**
 * Filing paperwork on a business's behalf, from the admin panel.
 *
 * Separate from `vendor-actions.ts` because the gate is different: that file is
 * `vendor.verify`/`vendor.suspend` correcting a listing's own fields, this one
 * touches the two things a business would normally only give us itself — its
 * identity documents and the account its money goes to. Both are audited inside
 * the services, which is where the write actually happens.
 *
 * The actions are thin on purpose. Every authorisation decision is in
 * `services/verification.ts` and `services/vendor-bank.ts`, mirrored by the
 * policies in migration 0040; nothing here may be the only thing standing
 * between a caller and a write (CLAUDE.md invariant 2).
 */

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The admin detail page and the queue that links into it. Deliberately not the
 * vendor's own dashboard paths: those render for a different signed-in user on
 * dynamic routes, so there is no cached copy of them to invalidate here.
 */
function revalidateVendor(vendorId: string): void {
  revalidatePath(`/admin/vendors/${vendorId}`)
  revalidatePath('/admin/vendors')
  revalidatePath('/admin/verifications')
}

/**
 * Upload a verification document for a business.
 *
 * `attached` covers the one case where the upload can half-succeed: a cancelled
 * cheque is also the document the payout account points at, and attaching it
 * needs `billing.manage` while uploading needs `vendor.verify`. An
 * `operations_admin` holds the second and not the first. The file is stored
 * either way, so reporting "uploaded" alone would leave the cheque sitting in
 * the document list, never becoming the cheque of record, with nobody told why.
 * Same shape, and the same reasoning, as `uploadChequeAction`.
 */
export async function adminUploadVendorDocumentAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ path: string; attached: boolean; reason: string | null }>> {
  const result = await runAction('admin.uploadVendorDocument', async () => {
    const actor = await getActor()
    const { vendorId, documentType } = adminUploadDocumentSchema.parse({
      vendorId: str(form, 'vendorId'),
      documentType: str(form, 'documentType'),
    })

    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      throw new ServiceError('invalid_file', 'Choose a file to upload.')
    }

    const uploaded = await uploadVerificationDocument(actor, vendorId, file, documentType)
    if (documentType !== CANCELLED_CHEQUE) {
      return { ...uploaded, attached: false, reason: null as string | null }
    }

    // `uploadVerificationDocument` returns the storage path rather than the row
    // id. Paths carry a UUID minted at upload time and the bucket refuses
    // `upsert`, so the path identifies exactly one row.
    const documentId = await getDocumentIdByStoragePath(uploaded.path)
    if (!documentId) return { ...uploaded, attached: false, reason: null as string | null }

    try {
      await setChequeDocument(actor, vendorId, documentId)
      return { ...uploaded, attached: true, reason: null as string | null }
    } catch (error) {
      const reason = error instanceof ServiceError ? error.message : null
      return { ...uploaded, attached: false, reason }
    }
  })

  if (result.ok) revalidateVendor(str(form, 'vendorId'))
  return result
}

export async function adminDeleteVendorDocumentAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('admin.deleteVendorDocument', async () => {
    const actor = await getActor()
    const documentId = str(form, 'documentId')
    if (!documentId) throw new ServiceError('validation_error', 'Missing document.')
    return deleteVerificationDocument(actor, documentId)
  })

  // The vendor is carried on the form only so the right page can be
  // revalidated — the service resolves it from the document itself, which is
  // the value the permission check runs against.
  if (result.ok) revalidateVendor(str(form, 'vendorId'))
  return result
}

/**
 * Enter or replace a business's payout details.
 *
 * The same schema the vendor's own form uses, including the confirmation field.
 * An admin typing an account number read out over the phone is *more* likely to
 * transpose a digit than the person reading it, not less, and a wrong digit is
 * a valid account number belonging to somebody else.
 */
export async function adminSaveBankAccountAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ vendorId: string }>> {
  const result = await runAction('admin.saveBankAccount', async () => {
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

    return saveBankAccount(actor, str(form, 'vendorId'), input)
  })

  if (result.ok) revalidateVendor(result.data.vendorId)
  return result
}

export async function adminDeleteBankAccountAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const vendorId = str(form, 'vendorId')

  const result = await runAction('admin.deleteBankAccount', async () => {
    const actor = await getActor()
    if (!vendorId) throw new ServiceError('validation_error', 'Missing business.')
    return deleteBankAccount(actor, vendorId)
  })

  if (result.ok) revalidateVendor(vendorId)
  return result
}
