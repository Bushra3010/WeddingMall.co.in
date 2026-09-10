import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ServiceError } from '@/lib/action-result'
import { can, canVendor, PermissionError, type Actor } from '@/lib/permissions'
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from '@/features/vendors/schema'
import { logError } from '@/lib/observability/logger'
import { audit } from '@/lib/security/audit'

const BUCKET = 'vendor-documents'

/**
 * Verification documents (PRD 6.4, 10.1).
 *
 * The bucket is private and has no anon policy. Files are never linked
 * directly — reads go through a short-lived signed URL issued only after a
 * permission check here.
 */

/**
 * Who may add or remove a document: the business's own team, or an admin who
 * verifies businesses.
 *
 * The admin branch arrives with migration 0040. Until it, an admin could open a
 * document and never add one — so a business signed up over the phone, whose
 * GST certificate is sitting in the salesperson's inbox, had no route in at all
 * except asking the owner to log in and do it themselves.
 *
 * `vendor.verify` and not `vendor.read`: the second is held by analysts,
 * content admins and support agents, and is the permission that merely lists
 * businesses. This mirrors the policies in 0040 exactly — RLS is the boundary,
 * and this exists to produce a sentence instead of a 42501 (CLAUDE.md
 * invariant 2).
 */
function assertMayManageDocuments(actor: Actor, vendorId: string): void {
  if (canVendor(actor, vendorId, 'team.manage')) return
  if (can(actor, 'vendor.verify')) return
  throw new PermissionError(
    'Adding or removing verification documents needs the vendor.verify permission, or the team.manage capability on this business.',
  )
}

/**
 * True when the actor is doing this to somebody else's business.
 *
 * Only these writes are audited. A business filing its own paperwork is not an
 * event anyone investigates; an administrator putting a document on another
 * company's record is, and PRD 10.3 asks for it.
 */
function actingAsAdmin(actor: Actor, vendorId: string): boolean {
  return !canVendor(actor, vendorId, 'team.manage') && can(actor, 'vendor.verify')
}

/**
 * Uploads through the service-role client rather than the user's session.
 *
 * The storage policy would permit the user's own upload, but routing it through
 * the server lets us validate MIME and size before anything is written, and
 * guarantees the object path is exactly `<vendorId>/…` — which is what the
 * read policy keys off. A client-chosen path could otherwise be crafted to sit
 * under another tenant's prefix.
 */
export async function uploadVerificationDocument(
  actor: Actor,
  vendorId: string,
  file: File,
  documentType: string,
) {
  assertMayManageDocuments(actor, vendorId)

  if (file.size === 0) {
    throw new ServiceError('invalid_file', 'That file is empty.')
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new ServiceError(
      'invalid_file',
      `Files must be under ${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB.`,
    )
  }
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_TYPES)[number])) {
    throw new ServiceError('invalid_file', 'Upload a PDF, JPEG, or PNG.')
  }

  const supabase = await createClient()

  // Reuse the open verification record so documents group under one review.
  let verificationId: string | undefined
  const { data: open } = await supabase
    .from('vendor_verifications')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('status', 'pending')
    .maybeSingle()

  if (open) {
    verificationId = open.id
  } else {
    const { data: created, error } = await supabase
      .from('vendor_verifications')
      .insert({ vendor_id: vendorId, type: 'business_registration', status: 'pending' })
      .select('id')
      .single()
    if (error || !created) {
      throw new ServiceError('internal_error', 'We could not start your verification.')
    }
    verificationId = created.id
  }

  const extension =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') ?? 'bin'
  const objectPath = `${vendorId}/${crypto.randomUUID()}.${extension}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    logError('service.uploadVerificationDocument', uploadError, { vendorId })
    throw new ServiceError('upload_failed', 'We could not upload that file. Please try again.')
  }

  const { error: rowError } = await supabase.from('vendor_documents').insert({
    verification_id: verificationId,
    storage_path: objectPath,
    document_type: documentType,
  })

  if (rowError) {
    // Do not leave an orphaned object behind if the row insert fails.
    await admin.storage.from(BUCKET).remove([objectPath])
    logError('service.uploadVerificationDocument.row', rowError, { vendorId })
    throw new ServiceError('internal_error', 'We could not record that document.')
  }

  /*
   * `void` for the reason `deleteVendorAsAdmin` gives: the file is stored and
   * the row is written, so a failed audit line must not turn a completed upload
   * into an error. `audit()` never throws and logs its own failure loudly.
   *
   * The entity is the vendor rather than the document, so the entry lands in
   * the trail that `/admin/vendors/[vendorId]` already renders — that page
   * filters `audit_logs` on `entity_id`, and an entry keyed to a document id
   * would be written and never seen.
   */
  if (actingAsAdmin(actor, vendorId)) {
    void audit({
      action: 'vendor.document',
      entityType: 'vendor',
      entityId: vendorId,
      actorUserId: actor.userId,
      after: { added: documentType, path: objectPath },
    })
  }

  return { path: objectPath }
}

/**
 * Short-lived signed URL. The permission check is here, not in the policy,
 * because the service-role client that mints the URL bypasses RLS.
 */
export async function getDocumentSignedUrl(
  actor: Actor,
  documentId: string,
  expiresInSeconds = 120,
): Promise<string> {
  const supabase = await createClient()

  const { data: doc, error } = await supabase
    .from('vendor_documents')
    .select('storage_path, vendor_verifications(vendor_id)')
    .eq('id', documentId)
    .maybeSingle()

  // RLS already restricts this read to vendor members and vendor.verify
  // admins, so a miss means "not allowed" as much as "not found".
  if (error || !doc) {
    throw new ServiceError('not_found', 'That document is not available.')
  }

  const vendorId = doc.vendor_verifications?.vendor_id
  const allowed =
    (vendorId && actor.vendorRoles[vendorId] !== undefined) || can(actor, 'vendor.verify')
  if (!allowed) {
    throw new ServiceError('forbidden', 'You do not have permission to view that document.')
  }

  const admin = createAdminClient()
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, expiresInSeconds)

  if (signError || !signed) {
    logError('service.getDocumentSignedUrl', signError, { documentId })
    throw new ServiceError('internal_error', 'We could not open that document.')
  }

  return signed.signedUrl
}

export async function deleteVerificationDocument(actor: Actor, documentId: string) {
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('vendor_documents')
    .select('storage_path, document_type, vendor_verifications(vendor_id)')
    .eq('id', documentId)
    .maybeSingle()

  if (!doc) throw new ServiceError('not_found', 'That document is not available.')

  const vendorId = doc.vendor_verifications?.vendor_id
  if (!vendorId) throw new ServiceError('not_found', 'That document is not available.')
  assertMayManageDocuments(actor, vendorId)

  const { error, count } = await supabase
    .from('vendor_documents')
    .delete({ count: 'exact' })
    .eq('id', documentId)
  if (error) throw new ServiceError('internal_error', 'We could not remove that document.')

  /*
   * A DELETE that RLS filters out reports success with zero rows — the same
   * shape `updateVendorAsAdmin` checks for. It matters more here than there:
   * the object below is removed with the service-role client, which bypasses
   * RLS, so reporting success on a filtered delete would take the *file* away
   * and leave the row pointing at nothing.
   */
  if (count === 0) {
    throw new ServiceError('forbidden', 'You cannot remove that document.')
  }

  await createAdminClient().storage.from(BUCKET).remove([doc.storage_path])

  if (actingAsAdmin(actor, vendorId)) {
    void audit({
      action: 'vendor.document',
      entityType: 'vendor',
      entityId: vendorId,
      actorUserId: actor.userId,
      before: { documentType: doc.document_type },
      after: { removed: doc.document_type },
    })
  }

  return { ok: true }
}
