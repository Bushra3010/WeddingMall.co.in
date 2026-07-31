import 'server-only'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ServiceError } from '@/lib/action-result'
import { assertPermission, assertVendorCapability, type Actor } from '@/lib/permissions'
import { logError } from '@/lib/observability/logger'
import { parseMajor } from '@/lib/money'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  type AvailabilityStatus,
  type ListingDecision,
  type PackageInput,
} from '@/features/listings/schema'

const MEDIA_BUCKET = 'vendor-media'

function translate(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code === 'P0001' || error?.code === 'P0002') {
    throw new ServiceError('invalid_state', error.message ?? fallback)
  }
  if (error?.code === '42501') {
    throw new ServiceError('forbidden', error.message ?? 'You do not have permission to do that.')
  }
  if (error?.code === '23505') throw new ServiceError('conflict', 'That value is already taken.')
  throw new ServiceError('internal_error', fallback)
}

/**
 * Submits the current draft as a new version. The published version stays live
 * until an admin approves the new one (PRD 6.9).
 */
export async function submitListing(actor: Actor, vendorId: string) {
  assertVendorCapability(actor, vendorId, 'listing.submit')
  const supabase = await createClient()

  const { error } = await supabase.rpc('submit_listing_for_review', { target_vendor: vendorId })
  if (error) translate(error, 'We could not submit your listing for review.')

  return { ok: true }
}

export async function moderateListingVersion(
  actor: Actor,
  versionId: string,
  decision: ListingDecision,
  reason?: string,
) {
  assertPermission(actor, 'listing.moderate')
  const supabase = await createClient()

  const { error } = await supabase.rpc('moderate_listing_version', {
    target_version: versionId,
    decision,
    reason: reason?.trim() || null,
  })
  if (error) translate(error, 'We could not record that decision.')

  // Publishing changes what the public site shows (PRD 8.3).
  const { data: version } = await supabase
    .from('vendor_listing_versions')
    .select('vendors(slug)')
    .eq('id', versionId)
    .maybeSingle()

  revalidatePath('/')
  revalidatePath('/vendors')
  const slug = version?.vendors?.slug
  if (slug) revalidatePath(`/vendor/${slug}`)

  return { ok: true, decision }
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

/** Money crosses the boundary as major units and is stored as minor units. */
function toMinor(value: number | undefined, currency: string): number | null {
  if (value === undefined || Number.isNaN(value)) return null
  const money = parseMajor(String(value), currency)
  if (!money) throw new ServiceError('validation_error', 'That price is not a valid amount.')
  return money.amountMinor
}

export async function savePackage(actor: Actor, vendorId: string, input: PackageInput) {
  assertVendorCapability(actor, vendorId, 'package.manage')
  const supabase = await createClient()

  const row = {
    vendor_id: vendorId,
    category_id: input.categoryId || null,
    name: input.name,
    description: input.description || null,
    price_type: input.priceType,
    min_amount_minor: toMinor(input.minAmount, input.currency),
    max_amount_minor: toMinor(input.maxAmount, input.currency),
    currency: input.currency,
    unit: input.unit || null,
    inclusions_json: input.inclusions,
    exclusions_json: input.exclusions,
    active: input.active,
    sort_order: input.sortOrder,
  }

  if (input.id) {
    const { error } = await supabase
      .from('vendor_packages')
      .update(row)
      .eq('id', input.id)
      .eq('vendor_id', vendorId)
    if (error) translate(error, 'We could not save that package.')
    return { id: input.id }
  }

  const { data, error } = await supabase.from('vendor_packages').insert(row).select('id').single()
  if (error || !data) translate(error, 'We could not create that package.')
  return { id: data.id }
}

export async function deletePackage(actor: Actor, vendorId: string, packageId: string) {
  assertVendorCapability(actor, vendorId, 'package.manage')
  const supabase = await createClient()

  const { error } = await supabase
    .from('vendor_packages')
    .delete()
    .eq('id', packageId)
    .eq('vendor_id', vendorId)
  if (error) translate(error, 'We could not remove that package.')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Portfolio media
// ---------------------------------------------------------------------------

/**
 * Uploaded through the service-role client so MIME and size are validated
 * before anything is written, and the object path is guaranteed to be
 * `<vendorId>/…` — the prefix the storage policy keys off. A client-chosen path
 * could otherwise be crafted to sit under another tenant's folder.
 *
 * New images enter as `pending`; they become public when the listing is
 * approved (PRD 6.9 — media carries a moderation state).
 */
export async function uploadMedia(
  actor: Actor,
  vendorId: string,
  file: File,
  altText: string | undefined,
) {
  assertVendorCapability(actor, vendorId, 'media.manage')

  if (file.size === 0) throw new ServiceError('invalid_file', 'That file is empty.')
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ServiceError(
      'invalid_file',
      `Images must be under ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
    )
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new ServiceError('invalid_file', 'Upload a JPEG, PNG, WebP, or AVIF image.')
  }

  const supabase = await createClient()

  const { count } = await supabase
    .from('vendor_media')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)

  const extension =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') ?? 'jpg'
  const objectPath = `${vendorId}/${crypto.randomUUID()}.${extension}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    logError('service.uploadMedia', uploadError, { vendorId })
    throw new ServiceError('upload_failed', 'We could not upload that image. Please try again.')
  }

  const { error: rowError } = await supabase.from('vendor_media').insert({
    vendor_id: vendorId,
    type: 'image',
    storage_path: objectPath,
    alt_text: altText || null,
    sort_order: count ?? 0,
    // The first image a vendor uploads becomes the cover.
    is_cover: (count ?? 0) === 0,
    moderation_status: 'pending',
    size_bytes: file.size,
  })

  if (rowError) {
    await admin.storage.from(MEDIA_BUCKET).remove([objectPath])
    logError('service.uploadMedia.row', rowError, { vendorId })
    throw new ServiceError('internal_error', 'We could not record that image.')
  }

  return { path: objectPath }
}

export async function updateMediaAlt(
  actor: Actor,
  vendorId: string,
  mediaId: string,
  altText: string | undefined,
) {
  assertVendorCapability(actor, vendorId, 'media.manage')
  const supabase = await createClient()

  const { error } = await supabase
    .from('vendor_media')
    .update({ alt_text: altText || null })
    .eq('id', mediaId)
    .eq('vendor_id', vendorId)
  if (error) translate(error, 'We could not save that description.')
  return { ok: true }
}

/** Exactly one cover per vendor is enforced by a partial unique index, so the
 * previous cover must be cleared before the new one is set. */
export async function setCoverMedia(actor: Actor, vendorId: string, mediaId: string) {
  assertVendorCapability(actor, vendorId, 'media.manage')
  const supabase = await createClient()

  const { error: clearError } = await supabase
    .from('vendor_media')
    .update({ is_cover: false })
    .eq('vendor_id', vendorId)
    .eq('is_cover', true)
  if (clearError) translate(clearError, 'We could not update your cover image.')

  const { error } = await supabase
    .from('vendor_media')
    .update({ is_cover: true })
    .eq('id', mediaId)
    .eq('vendor_id', vendorId)
  if (error) translate(error, 'We could not update your cover image.')
  return { ok: true }
}

export async function deleteMedia(actor: Actor, vendorId: string, mediaId: string) {
  assertVendorCapability(actor, vendorId, 'media.manage')
  const supabase = await createClient()

  const { data: media } = await supabase
    .from('vendor_media')
    .select('storage_path, is_cover')
    .eq('id', mediaId)
    .eq('vendor_id', vendorId)
    .maybeSingle()
  if (!media) throw new ServiceError('not_found', 'That image was not found.')

  const { error } = await supabase
    .from('vendor_media')
    .delete()
    .eq('id', mediaId)
    .eq('vendor_id', vendorId)
  if (error) translate(error, 'We could not remove that image.')

  await createAdminClient().storage.from(MEDIA_BUCKET).remove([media.storage_path])

  // Deleting the cover must not leave the listing without one.
  if (media.is_cover) {
    const { data: next } = await supabase
      .from('vendor_media')
      .select('id')
      .eq('vendor_id', vendorId)
      .order('sort_order')
      .limit(1)
      .maybeSingle()
    if (next) {
      await supabase.from('vendor_media').update({ is_cover: true }).eq('id', next.id)
    }
  }

  return { ok: true }
}

export async function reorderMedia(actor: Actor, vendorId: string, orderedIds: string[]) {
  assertVendorCapability(actor, vendorId, 'media.manage')
  const supabase = await createClient()

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from('vendor_media')
      .update({ sort_order: index })
      .eq('id', id)
      .eq('vendor_id', vendorId)
    if (error) translate(error, 'We could not reorder your images.')
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export async function saveAvailability(
  actor: Actor,
  vendorId: string,
  input: { startDate: string; endDate: string; status: AvailabilityStatus; note?: string },
) {
  assertVendorCapability(actor, vendorId, 'availability.manage')
  const supabase = await createClient()

  const { error } = await supabase.from('vendor_availability').insert({
    vendor_id: vendorId,
    start_date: input.startDate,
    end_date: input.endDate,
    status: input.status,
    // Private: the public profile only ever shows the status signal.
    note_private: input.note || null,
  })
  if (error) translate(error, 'We could not save that availability.')
  return { ok: true }
}

export async function deleteAvailability(actor: Actor, vendorId: string, entryId: string) {
  assertVendorCapability(actor, vendorId, 'availability.manage')
  const supabase = await createClient()

  const { error } = await supabase
    .from('vendor_availability')
    .delete()
    .eq('id', entryId)
    .eq('vendor_id', vendorId)
  if (error) translate(error, 'We could not remove that entry.')
  return { ok: true }
}
