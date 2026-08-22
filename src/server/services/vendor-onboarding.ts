import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ServiceError } from '@/lib/action-result'
import { assertVendorCapability, type Actor } from '@/lib/permissions'
import { slugify } from '@/features/vendors/schema'
import type { CreateVendorInput, VendorProfileInput } from '@/features/vendors/schema'

/**
 * Vendor onboarding services.
 *
 * Every mutation re-checks capability here even though RLS also enforces it —
 * the UI is never the authority (CLAUDE.md invariant 2). Postgres errors are
 * translated into `ServiceError` so users never see a raw database message
 * (PRD 15).
 */

/** Maps a Postgres error onto a user-safe ServiceError. */
function translate(error: { code?: string; message?: string } | null, fallback: string): never {
  const code = error?.code
  const message = error?.message ?? ''

  // Raised deliberately by our RPCs with a user-facing message.
  if (code === 'P0001' || code === 'P0002') {
    throw new ServiceError('invalid_state', message)
  }
  if (code === '42501') {
    throw new ServiceError('forbidden', message || 'You do not have permission to do that.')
  }
  if (code === '23505') {
    throw new ServiceError('conflict', 'That value is already taken.')
  }
  throw new ServiceError('internal_error', fallback)
}

/** Finds a free slug. Races are still caught by the unique constraint. */
export async function uniqueSlug(base: string): Promise<string> {
  const supabase = await createClient()
  const root = slugify(base) || 'business'

  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`
    const { data } = await supabase.from('vendors').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
  }
  return `${root}-${Date.now().toString(36)}`
}

/**
 * Creates the vendor, the owner membership, and the draft listing.
 *
 * Not atomic: PostgREST has no multi-statement transaction. The order is chosen
 * so a partial failure is recoverable rather than orphaning anything — the
 * vendor row is useless without a membership, and `getMyVendors` will not
 * surface it, so a retry produces a clean record. If this proves flaky under
 * real traffic, move it into a SECURITY DEFINER RPC like the other flows.
 */
export async function createVendor(actor: Actor, input: CreateVendorInput) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in first.')

  const supabase = await createClient()
  const slug = await uniqueSlug(input.displayName)

  const { data: vendor, error } = await supabase
    .from('vendors')
    .insert({
      display_name: input.displayName,
      slug,
      owner_user_id: actor.userId,
      status: 'draft',
      primary_city_id: input.primaryCityId,
    })
    .select('id, slug')
    .single()

  if (error || !vendor) translate(error, 'We could not create your business profile.')

  const { error: membershipError } = await supabase.from('vendor_memberships').insert({
    vendor_id: vendor.id,
    user_id: actor.userId,
    role: 'vendor_owner',
    status: 'active',
  })
  if (membershipError) translate(membershipError, 'We could not set up your account access.')

  const { error: listingError } = await supabase
    .from('vendor_listings')
    .insert({ vendor_id: vendor.id, status: 'draft' })
  if (listingError) translate(listingError, 'We could not create your listing draft.')

  const { error: categoryError } = await supabase
    .from('vendor_categories')
    .insert({ vendor_id: vendor.id, category_id: input.primaryCategoryId, is_primary: true })
  if (categoryError) translate(categoryError, 'We could not save your category.')

  // A business almost always serves its own city; the vendor can edit this.
  await supabase
    .from('vendor_service_areas')
    .insert({ vendor_id: vendor.id, city_id: input.primaryCityId, travel_available: false })

  return { vendorId: vendor.id, slug: vendor.slug }
}

export async function saveVendorProfile(actor: Actor, vendorId: string, input: VendorProfileInput) {
  assertVendorCapability(actor, vendorId, 'listing.edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('vendors')
    .update({
      display_name: input.displayName,
      legal_name: input.legalName || null,
      primary_city_id: input.primaryCityId,
      email: input.email || null,
      phone: input.phone || null,
      website: input.website || null,
      founded_year: input.foundedYear ?? null,
    })
    .eq('id', vendorId)

  if (error) translate(error, 'We could not save your business details.')
  return { vendorId }
}

export async function saveVendorListing(
  actor: Actor,
  vendorId: string,
  input: { about: string; experienceYears?: number; languages: string[] },
) {
  assertVendorCapability(actor, vendorId, 'listing.edit')
  const supabase = await createClient()

  const { error } = await supabase.from('vendor_listings').upsert(
    {
      vendor_id: vendorId,
      about: input.about,
      experience_years: input.experienceYears ?? null,
      languages: input.languages,
    },
    { onConflict: 'vendor_id' },
  )

  if (error) translate(error, 'We could not save your listing.')
  return { vendorId }
}

export async function saveCategories(
  actor: Actor,
  vendorId: string,
  primaryCategoryId: string,
  additionalCategoryIds: string[],
) {
  assertVendorCapability(actor, vendorId, 'listing.edit')
  const supabase = await createClient()

  // Replace wholesale. The partial unique index allows only one primary, so
  // the delete must land before the insert.
  const { error: deleteError } = await supabase
    .from('vendor_categories')
    .delete()
    .eq('vendor_id', vendorId)
  if (deleteError) translate(deleteError, 'We could not update your categories.')

  const rows = [
    { vendor_id: vendorId, category_id: primaryCategoryId, is_primary: true },
    ...additionalCategoryIds
      .filter((id) => id !== primaryCategoryId)
      .map((id) => ({ vendor_id: vendorId, category_id: id, is_primary: false })),
  ]

  const { error } = await supabase.from('vendor_categories').insert(rows)
  if (error) translate(error, 'We could not update your categories.')
  return { vendorId }
}

export async function saveServiceAreas(
  actor: Actor,
  vendorId: string,
  cityIds: string[],
  travelAvailable: boolean,
) {
  assertVendorCapability(actor, vendorId, 'listing.edit')
  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from('vendor_service_areas')
    .delete()
    .eq('vendor_id', vendorId)
  if (deleteError) translate(deleteError, 'We could not update your service areas.')

  const { error } = await supabase.from('vendor_service_areas').insert(
    cityIds.map((cityId) => ({
      vendor_id: vendorId,
      city_id: cityId,
      travel_available: travelAvailable,
    })),
  )
  if (error) translate(error, 'We could not update your service areas.')
  return { vendorId }
}

/**
 * Submission goes through the RPC so the status change, the verification
 * record, and the audit entry happen in one transaction.
 */
export async function submitForReview(actor: Actor, vendorId: string) {
  assertVendorCapability(actor, vendorId, 'listing.submit')
  const supabase = await createClient()

  const { error } = await supabase.rpc('submit_vendor_for_review', { target_vendor: vendorId })
  if (error) translate(error, 'We could not submit your business for review.')

  return { vendorId, status: 'pending_review' as const }
}
