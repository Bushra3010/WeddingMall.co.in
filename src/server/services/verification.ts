import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ServiceError } from '@/lib/action-result'
import { assertVendorCapability, can, type Actor } from '@/lib/permissions'
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from '@/features/vendors/schema'
import { logError } from '@/lib/observability/logger'

const BUCKET = 'vendor-documents'

/**
 * Verification documents (PRD 6.4, 10.1).
 *
 * The bucket is private and has no anon policy. Files are never linked
 * directly — reads go through a short-lived signed URL issued only after a
 * permission check here.
 */

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
  assertVendorCapability(actor, vendorId, 'team.manage')

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
    .select('storage_path, vendor_verifications(vendor_id)')
    .eq('id', documentId)
    .maybeSingle()

  if (!doc) throw new ServiceError('not_found', 'That document is not available.')

  const vendorId = doc.vendor_verifications?.vendor_id
  if (!vendorId) throw new ServiceError('not_found', 'That document is not available.')
  assertVendorCapability(actor, vendorId, 'team.manage')

  const { error } = await supabase.from('vendor_documents').delete().eq('id', documentId)
  if (error) throw new ServiceError('internal_error', 'We could not remove that document.')

  await createAdminClient().storage.from(BUCKET).remove([doc.storage_path])
  return { ok: true }
}
