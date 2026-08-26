'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { getActor } from '@/server/dal/actor'
import { autoConfirmUser } from '@/server/jobs/confirm-user'
import { log } from '@/lib/observability/logger'
import {
  CURRENT_POLICY_VERSION,
} from '@/features/auth/schema'
import {
  createVendor,
  saveCategories,
  saveServiceAreas,
  saveVendorListing,
  saveVendorProfile,
  submitForReview,
  uniqueSlug,
} from '@/server/services/vendor-onboarding'
import { changeMemberRole, inviteMember, revokeMember } from '@/server/services/vendor-team'
import {
  deleteVerificationDocument,
  uploadVerificationDocument,
} from '@/server/services/verification'
import { decideVendor } from '@/server/services/moderation'
import {
  adminDecisionSchema,
  categorySelectionSchema,
  createVendorSchema,
  inviteMemberSchema,
  memberRoleSchema,
  serviceAreaSchema,
  uploadDocumentSchema,
  vendorListingSchema,
  vendorProfileSchema,
} from './schema'

/**
 * Server Actions for Milestone 2.
 *
 * Each one resolves the actor server-side and passes it to a service — the
 * form never supplies identity, role, or vendor ownership (PRD 8.3: "never
 * trust request form fields for role, owner, vendor ID, price totals, or
 * status transitions").
 */

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function strList(form: FormData, key: string): string[] {
  return form.getAll(key).filter((v): v is string => typeof v === 'string' && v.length > 0)
}

/** The vendor id always comes from the form, but capability is checked against
 * the session actor — a forged id fails the capability assert and RLS. */
function vendorId(form: FormData): string {
  return str(form, 'vendorId')
}

export async function createVendorAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ vendorId: string }>> {
  let created: { vendorId: string } | null = null

  const result = await runAction('vendor.create', async () => {
    const actor = await getActor()
    const input = createVendorSchema.parse({
      displayName: str(form, 'displayName'),
      primaryCityId: str(form, 'primaryCityId'),
      primaryCategoryId: str(form, 'primaryCategoryId'),
    })
    const out = await createVendor(actor, input)
    created = { vendorId: out.vendorId }
    return created
  })

  if (result.ok && created) {
    revalidatePath('/vendor-dashboard', 'layout')
    redirect('/vendor-dashboard/list')
  }
  return result
}

export async function saveProfileAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ vendorId: string }>> {
  const result = await runAction('vendor.saveProfile', async () => {
    const actor = await getActor()
    const input = vendorProfileSchema.parse({
      displayName: str(form, 'displayName'),
      legalName: str(form, 'legalName'),
      primaryCityId: str(form, 'primaryCityId'),
      email: str(form, 'email'),
      phone: str(form, 'phone'),
      website: str(form, 'website'),
      foundedYear: str(form, 'foundedYear') || undefined,
    })
    return saveVendorProfile(actor, vendorId(form), input)
  })

  if (result.ok) revalidatePath('/vendor-dashboard', 'layout')
  return result
}

export async function saveListingAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ vendorId: string }>> {
  const result = await runAction('vendor.saveListing', async () => {
    const actor = await getActor()
    const input = vendorListingSchema.parse({
      about: str(form, 'about'),
      experienceYears: str(form, 'experienceYears') || undefined,
      languages: strList(form, 'languages'),
    })
    return saveVendorListing(actor, vendorId(form), input)
  })

  if (result.ok) revalidatePath('/vendor-dashboard', 'layout')
  return result
}

export async function saveCategoriesAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ vendorId: string }>> {
  const result = await runAction('vendor.saveCategories', async () => {
    const actor = await getActor()
    const input = categorySelectionSchema.parse({
      primaryCategoryId: str(form, 'primaryCategoryId'),
      additionalCategoryIds: strList(form, 'additionalCategoryIds'),
    })
    return saveCategories(
      actor,
      vendorId(form),
      input.primaryCategoryId,
      input.additionalCategoryIds,
    )
  })

  if (result.ok) revalidatePath('/vendor-dashboard', 'layout')
  return result
}

export async function saveServiceAreasAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ vendorId: string }>> {
  const result = await runAction('vendor.saveServiceAreas', async () => {
    const actor = await getActor()
    const input = serviceAreaSchema.parse({
      cityIds: strList(form, 'cityIds'),
      travelAvailable: form.get('travelAvailable') === 'on',
    })
    return saveServiceAreas(actor, vendorId(form), input.cityIds, input.travelAvailable)
  })

  if (result.ok) revalidatePath('/vendor-dashboard', 'layout')
  return result
}

export async function uploadDocumentAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ path: string }>> {
  const result = await runAction('vendor.uploadDocument', async () => {
    const actor = await getActor()
    const { documentType } = uploadDocumentSchema.parse({
      documentType: str(form, 'documentType'),
    })
    const file = form.get('file')
    if (!(file instanceof File)) {
      throw new ServiceError('invalid_file', 'Choose a file to upload.')
    }
    return uploadVerificationDocument(actor, vendorId(form), file, documentType)
  })

  if (result.ok) revalidatePath('/vendor-dashboard/onboarding')
  return result
}

export async function deleteDocumentAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('vendor.deleteDocument', async () => {
    const actor = await getActor()
    return deleteVerificationDocument(actor, str(form, 'documentId'))
  })

  if (result.ok) revalidatePath('/vendor-dashboard/onboarding')
  return result
}

export async function submitForReviewAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ status: string }>> {
  const result = await runAction('vendor.submitForReview', async () => {
    const actor = await getActor()
    return submitForReview(actor, vendorId(form))
  })

  if (result.ok) revalidatePath('/vendor-dashboard', 'layout')
  return result
}

export async function inviteMemberAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('vendor.inviteMember', async () => {
    const actor = await getActor()
    const input = inviteMemberSchema.parse({
      email: str(form, 'email'),
      role: str(form, 'role'),
    })
    return inviteMember(actor, vendorId(form), input.email, input.role)
  })

  if (result.ok) revalidatePath('/vendor-dashboard/team')
  return result
}

export async function changeMemberRoleAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('vendor.changeMemberRole', async () => {
    const actor = await getActor()
    const input = memberRoleSchema.parse({
      membershipId: str(form, 'membershipId'),
      role: str(form, 'role'),
    })
    return changeMemberRole(actor, vendorId(form), input.membershipId, input.role)
  })

  if (result.ok) revalidatePath('/vendor-dashboard/team')
  return result
}

export async function revokeMemberAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('vendor.revokeMember', async () => {
    const actor = await getActor()
    return revokeMember(actor, vendorId(form), str(form, 'membershipId'))
  })

  if (result.ok) revalidatePath('/vendor-dashboard/team')
  return result
}

export async function registerVendorAndCreateAccount(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ vendorId: string }>> {
  let created: { vendorId: string } | null = null

  const result = await runAction('vendor.register', async () => {
    const input = createVendorSchema.parse({
      displayName: str(form, 'displayName'),
      primaryCityId: str(form, 'primaryCityId'),
      primaryCategoryId: str(form, 'primaryCategoryId'),
    })

    const fullName = str(form, 'fullName')
    const email = str(form, 'email')
    const password = str(form, 'password')
    const acceptTerms = form.get('acceptTerms') === 'on' || form.get('acceptTerms') === 'true'

    if (!fullName || !email || !password) {
      throw new ServiceError('missing_fields', 'Please fill in all account details.')
    }
    if (!acceptTerms) {
      throw new ServiceError('terms_required', 'You must accept the terms to continue.')
    }

    const supabase = await createClient()

    // Create auth account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/vendor-dashboard/list`,
      },
    })

    if (authError || !authData.user) {
      throw new ServiceError(
        'signup_failed',
        authError?.message ?? 'We could not create your account. Try again.',
      )
    }

    const userId = authData.user.id

    // Auto-confirm so the user can log in immediately without checking email.
    await autoConfirmUser(userId)

    // Record consent
    const forwarded = (await headers()).get('x-forwarded-for')
    await supabase.from('user_consents').insert({
      user_id: userId,
      consent_type: 'terms_and_privacy',
      policy_version: CURRENT_POLICY_VERSION,
      granted: true,
      source: forwarded ? 'web' : 'web',
    })

    // When email confirmation is enabled, signUp doesn't return a session even
    // after we auto-confirm the user. Sign them in directly so they land on
    // the listing without a manual login step.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      log.warn('vendor.register.autoSignIn.failed', { reason: signInError.message, email })
    }

    // Create vendor
    const slug = await uniqueSlug(input.displayName)

    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .insert({
        display_name: input.displayName,
        slug,
        owner_user_id: userId,
        status: 'draft',
        primary_city_id: input.primaryCityId,
      })
      .select('id, slug')
      .single()

    if (vendorError || !vendor) {
      throw new ServiceError('vendor_creation_failed', 'We could not create your business profile.')
    }

    // Create membership
    const { error: membershipError } = await supabase.from('vendor_memberships').insert({
      vendor_id: vendor.id,
      user_id: userId,
      role: 'vendor_owner',
      status: 'active',
    })
    if (membershipError) {
      throw new ServiceError('membership_failed', 'We could not set up your account access.')
    }

    // Create draft listing
    const { error: listingError } = await supabase
      .from('vendor_listings')
      .insert({ vendor_id: vendor.id, status: 'draft' })
    if (listingError) {
      throw new ServiceError('listing_failed', 'We could not create your listing draft.')
    }

    // Save category
    const { error: categoryError } = await supabase
      .from('vendor_categories')
      .insert({ vendor_id: vendor.id, category_id: input.primaryCategoryId, is_primary: true })
    if (categoryError) {
      throw new ServiceError('category_failed', 'We could not save your category.')
    }

    // Save service area
    await supabase
      .from('vendor_service_areas')
      .insert({ vendor_id: vendor.id, city_id: input.primaryCityId, travel_available: false })

    created = { vendorId: vendor.id }
    return created
  })

  if (result.ok && created) {
    revalidatePath('/vendor-dashboard', 'layout')
    redirect('/vendor-dashboard/list')
  }
  return result
}
export async function decideVendorAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean; decision: string }>> {
  const result = await runAction('admin.decideVendor', async () => {
    const actor = await getActor()
    const input = adminDecisionSchema.parse({
      vendorId: str(form, 'vendorId'),
      decision: str(form, 'decision'),
      reason: str(form, 'reason'),
    })
    return decideVendor(actor, input)
  })

  if (result.ok) {
    revalidatePath('/admin/verifications')
    revalidatePath('/admin/vendors')
  }
  return result
}
