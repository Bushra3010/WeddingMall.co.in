import { z } from 'zod'

import { DOCUMENT_KINDS } from '@/features/vendors/schema'

/**
 * Document kinds an admin may file on a business's behalf (migration 0040).
 *
 * The vendor's own list plus `cancelled_cheque`, which already exists as a
 * `document_type` — `uploadChequeAction` writes it — but is deliberately absent
 * from `DOCUMENT_KINDS`, because a vendor uploads their cheque from the Bank
 * step of the wizard and offering it twice would be two controls doing one
 * thing.
 *
 * An admin has no Bank step. This screen is the only place they can file one,
 * so it belongs in the list here and nowhere else. Kept in its own module
 * rather than in the actions file because a `'use server'` module may export
 * only async functions.
 */
export const CANCELLED_CHEQUE = 'cancelled_cheque'

export const ADMIN_DOCUMENT_KINDS = [
  ...DOCUMENT_KINDS,
  { value: CANCELLED_CHEQUE, label: 'Cancelled cheque' },
] as const

export const adminUploadDocumentSchema = z.object({
  vendorId: z.uuid(),
  documentType: z.enum(ADMIN_DOCUMENT_KINDS.map((d) => d.value) as [string, ...string[]]),
})
