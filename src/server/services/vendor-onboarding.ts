import 'server-only'

import { logError } from '@/lib/observability/logger'

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
/**
 * A slug that is probably free.
 *
 * **Best effort only.** The lookup runs through the request-scoped client, so
 * RLS applies and rows the caller cannot see — another owner's draft vendor,
 * most commonly — read as absent. Callers must still handle a 23505 from the
 * unique index rather than treating this as a guarantee; `createVendorForUser`
 * shows the pattern. Trusting this as authoritative is what broke vendor
 * sign-up for anyone whose name collided with an existing draft.
 */
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
 * Insert a registering business, in the review queue where the database allows
 * it.
 *
 * ## Why this is not a plain insert
 *
 * Registration writes `pending_review`, which migration 0035 permits by
 * widening the `vendors: create own` policy from `status = 'draft'`. Until that
 * migration is applied the old policy is still in force and the insert is
 * refused outright with 42501 — so shipping this code ahead of its migration
 * takes vendor sign-up down completely.
 *
 * Deploys and migrations are separate actions here (Railway has no deploy
 * trigger; migrations are applied by hand), so "the code is ahead of the
 * schema" is a state this application will genuinely be in. A registration that
 * lands in `draft` is the behaviour from before this change and is recoverable
 * — the vendor submits from the wizard. A registration that 500s is not.
 *
 * **This fallback is temporary.** Once 0035 is applied the first branch always
 * wins and the second is dead code; delete it then. The warning exists so that
 * "new vendors still are not reaching the queue" is answerable from the logs
 * rather than by re-deriving this whole investigation.
 */
export async function insertRegisteringVendor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: {
    display_name: string
    slug: string
    owner_user_id: string
    primary_city_id?: string | null
  },
) {
  const queued = await supabase
    .from('vendors')
    .insert({ ...row, status: 'pending_review', submitted_at: new Date().toISOString() })
    .select('id, slug, status')
    .single()

  // 42501 here means one specific thing: the insert policy still requires
  // `draft`. Any other failure is a real one and is returned untouched.
  if (queued.error?.code !== '42501') return queued

  logError(
    'vendor.register.migration0035NotApplied',
    new Error('vendors: create own still requires draft — registration fell back'),
    { slug: row.slug },
  )

  return supabase
    .from('vendors')
    .insert({ ...row, status: 'draft' })
    .select('id, slug, status')
    .single()
}

/**
 * The listing status that goes with a freshly inserted vendor.
 *
 * Read from the row that came back rather than assumed, so the fallback above
 * cannot leave a `draft` business carrying a `pending` listing. That pairing is
 * a real defect in this database already — one vendor sits in the listing
 * moderation queue while absent from the vendor queue — and it is not worth
 * manufacturing more of it.
 */
function listingStateFor(vendorStatus: string) {
  return vendorStatus === 'pending_review'
    ? { status: 'pending' as const, submitted_at: new Date().toISOString() }
    : { status: 'draft' as const, submitted_at: null }
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

  // Same reasoning as `registerVendorAndCreateAccount`: this form already
  // collects a name, a city, and a category, so the business is substantial
  // enough to be looked at. It goes to the queue rather than to a draft nobody
  // watches. Permitted by the widened insert policy in migration 0035.
  const { data: vendor, error } = await insertRegisteringVendor(supabase, {
    display_name: input.displayName,
    slug,
    owner_user_id: actor.userId,
    primary_city_id: input.primaryCityId,
  })

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
    .insert({ vendor_id: vendor.id, ...listingStateFor(vendor.status) })
  if (listingError) translate(listingError, 'We could not create your listing draft.')

  const { error: categoryError } = await supabase
    .from('vendor_categories')
    .insert({ vendor_id: vendor.id, category_id: input.primaryCategoryId, is_primary: true })
  if (categoryError) translate(categoryError, 'We could not save your category.')

  // A business almost always serves its own city; the vendor can edit this.
  await supabase
    .from('vendor_service_areas')
    .insert({ vendor_id: vendor.id, city_id: input.primaryCityId, travel_available: false })

  // The record the verification queue and the document count read from. Only
  // opened for a business that is actually awaiting review — a draft has
  // nothing to verify yet, and `submit_vendor_for_review()` opens one when it
  // gets there.
  if (vendor.status === 'pending_review') {
    await supabase.from('vendor_verifications').insert({
      vendor_id: vendor.id,
      type: 'business_registration',
      status: 'pending',
      submitted_at: new Date().toISOString(),
    })
  }

  return { vendorId: vendor.id, slug: vendor.slug }
}

/**
 * Creates a minimal draft vendor for a user who just signed up.
 * Used when a user lands in the wizard without an existing vendor.
 *
 * Stays `draft` while the two real registration paths above now open at
 * `pending_review`. This one is not a registration — it is the recovery path
 * for someone who reached the wizard without a vendor row, so it has no city,
 * no category, and a display name guessed from their profile. Putting that in
 * the review queue would give an admin a row with nothing in it to review and
 * no way to tell it apart from a business that had actually applied. It becomes
 * `pending_review` the moment they finish the wizard and submit.
 */
export async function createVendorForUser(actor: Actor): Promise<string | null> {
  if (!actor.userId) return null

  try {
    const supabase = await createClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', actor.userId)
      .maybeSingle()

    const displayName = profile?.full_name || 'My Business'
    /*
     * The unique index decides, not a lookup.
     *
     * `uniqueSlug` searches through the request-scoped client, which is subject
     * to RLS — and a draft vendor belonging to someone else is invisible under
     * those policies. So it reported a slug as free that already existed, and
     * every sign-up by a user whose name matched an existing draft died on
     * 23505 and bounced them back to /vendor/join. Two users called "alok" was
     * all it took.
     *
     * "No row visible" never proves "no row exists" when RLS is in the way, so
     * the insert is attempted and a duplicate is treated as a taken name rather
     * than an error. The database is the only thing that can answer this.
     */
    const root = slugify(displayName) || 'business'
    let vendor: { id: string } | null = null
    let slug = root

    for (let attempt = 0; attempt < 12; attempt++) {
      slug = attempt === 0 ? root : `${root}-${attempt + 1}`

      const { data, error } = await supabase
        .from('vendors')
        .insert({
          display_name: displayName,
          slug,
          owner_user_id: actor.userId,
          status: 'draft',
        })
        .select('id')
        .single()

      if (!error && data) {
        vendor = data
        break
      }

      // 23505 is the slug already being taken — try the next candidate.
      if (error?.code === '23505') continue

      logError('vendor.autoCreate.insertFailed', error, { userId: actor.userId, slug })
      return null
    }

    if (!vendor) {
      logError('vendor.autoCreate.slugExhausted', new Error('no free slug after 12 attempts'), {
        userId: actor.userId,
        root,
      })
      return null
    }

    await supabase.from('vendor_memberships').insert({
      vendor_id: vendor.id,
      user_id: actor.userId,
      role: 'vendor_owner',
      status: 'active',
    })

    await supabase.from('vendor_listings').insert({
      vendor_id: vendor.id,
      status: 'draft',
    })

    return vendor.id
  } catch (error) {
    logError('vendor.autoCreate.threw', error, { userId: actor.userId })
    return null
  }
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
