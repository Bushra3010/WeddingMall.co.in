import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ServiceError } from '@/lib/action-result'
import { type Actor } from '@/lib/permissions'
import { checkTransition, type EnquiryStatus } from '@/features/enquiries/status'
import { rupeesToMinor, type EnquiryInput } from '@/features/enquiries/schema'
import { sendEmail } from '@/lib/notifications/email'
import { logError } from '@/lib/observability/logger'

/**
 * Customer marketplace services (PRD 6.5–6.7).
 *
 * Submission, transitions, and messaging all go through SQL functions or
 * trigger-guarded writes, so the lifecycle rules hold even for a caller that
 * reaches PostgREST directly. These wrappers add the friendly error and the
 * side effects that do not belong in the database.
 */

function translate(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code === 'P0001' || error?.code === 'P0002') {
    throw new ServiceError('invalid_state', error.message ?? fallback)
  }
  if (error?.code === '42501') {
    throw new ServiceError('forbidden', error.message ?? 'You do not have permission to do that.')
  }
  if (error?.code === '23505') {
    throw new ServiceError('conflict', 'That has already been saved.')
  }
  throw new ServiceError('internal_error', fallback)
}

export interface SubmitResult {
  enquiryId: string
  duplicate: boolean
  duplicateWarning: boolean
}

export async function submitEnquiry(actor: Actor, input: EnquiryInput): Promise<SubmitResult> {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in to send an enquiry.')

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('submit_enquiry', {
    payload: {
      vendorId: input.vendorId,
      categoryId: input.categoryId || null,
      cityId: input.cityId || null,
      eventDate: input.eventDate || null,
      flexibleDate: input.flexibleDate || null,
      budgetMinMinor: rupeesToMinor(input.budgetMinMinor) ?? null,
      budgetMaxMinor: rupeesToMinor(input.budgetMaxMinor) ?? null,
      guestCount: input.guestCount ?? null,
      message: input.message,
      preferredContactMode: input.preferredContactMode,
      contactConsent: input.contactConsent,
      idempotencyKey: input.idempotencyKey,
    },
  })

  if (error) translate(error, 'We could not send your enquiry.')

  const result = data as { enquiryId: string; duplicate: boolean; duplicateWarning: boolean }

  // A notification failure must never roll back the enquiry (PRD 14.2).
  if (!result.duplicate) {
    void notifyVendorOfEnquiry(result.enquiryId).catch((cause) =>
      logError('service.notifyVendorOfEnquiry', cause, { enquiryId: result.enquiryId }),
    )
  }

  return result
}

async function notifyVendorOfEnquiry(enquiryId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('enquiries')
    .select('id, vendors(display_name, email)')
    .eq('id', enquiryId)
    .maybeSingle()

  const email = data?.vendors?.email
  if (!email) return

  await sendEmail({
    to: email,
    templateCode: 'enquiry.new.vendor',
    subject: `New enquiry for ${data?.vendors?.display_name ?? 'your business'}`,
    body: 'You have a new enquiry. Open your dashboard to read it and reply.',
  })
}

export async function transitionEnquiry(
  actor: Actor,
  enquiryId: string,
  next: EnquiryStatus,
  reason?: string,
) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in first.')

  const supabase = await createClient()

  // Pre-check against the shared map so the user gets a precise message. The
  // database trigger is still the boundary that decides.
  const { data: current } = await supabase
    .from('enquiries')
    .select('status, customer_id, vendor_id')
    .eq('id', enquiryId)
    .maybeSingle()

  if (!current) throw new ServiceError('not_found', 'That enquiry was not found.')

  const actorType =
    current.customer_id === actor.userId
      ? 'customer'
      : actor.vendorRoles[current.vendor_id]
        ? 'vendor'
        : 'admin'

  const check = checkTransition(current.status as EnquiryStatus, next, actorType)
  if (!check.allowed) {
    throw new ServiceError('invalid_transition', check.reason ?? 'That change is not allowed.')
  }
  if (check.requiresReason && !reason?.trim()) {
    throw new ServiceError('reason_required', 'Please give a reason for this change.')
  }

  const { error } = await supabase.rpc('transition_enquiry', {
    target_enquiry: enquiryId,
    next_status: next,
    reason: reason?.trim() || null,
  })
  if (error) translate(error, 'We could not update that enquiry.')

  return { ok: true, status: next }
}

export async function sendMessage(actor: Actor, enquiryId: string, body: string) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in first.')

  const supabase = await createClient()

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, status')
    .eq('enquiry_id', enquiryId)
    .maybeSingle()

  if (!conversation) throw new ServiceError('not_found', 'That conversation was not found.')
  if (conversation.status !== 'open') {
    throw new ServiceError('invalid_state', 'This conversation is closed.')
  }

  // `sender_user_id` is set from the session, never from the form — the RLS
  // policy also requires it to equal auth.uid() (PRD 8.3).
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender_user_id: actor.userId,
    body,
  })

  if (error) translate(error, 'We could not send that message.')
  return { ok: true }
}

export async function markMessagesRead(actor: Actor, enquiryId: string) {
  if (!actor.userId) return { ok: true }
  const supabase = await createClient()

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('enquiry_id', enquiryId)
    .maybeSingle()
  if (!conversation) return { ok: true }

  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversation.id)
    .neq('sender_user_id', actor.userId)
    .is('read_at', null)

  return { ok: true }
}

/** A vendor opening an enquiry moves it from delivered to viewed, once. */
export async function markEnquiryViewed(actor: Actor, enquiryId: string) {
  if (!actor.userId) return
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_enquiry_viewed', { target_enquiry: enquiryId })
  if (error) logError('service.markEnquiryViewed', error, { enquiryId })
}

// ---------------------------------------------------------------------------
// Wedding profile and shortlist
// ---------------------------------------------------------------------------

export async function saveWeddingProfile(
  actor: Actor,
  input: {
    displayLabel?: string
    weddingDate?: string
    flexibleMonth?: string
    primaryCityId?: string
    budgetMinMinor?: number
    budgetMaxMinor?: number
    guestCount?: number
    notes?: string
    requiredCategoryIds: string[]
  },
) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in first.')
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('wedding_profiles')
    .upsert(
      {
        user_id: actor.userId,
        display_label: input.displayLabel || null,
        wedding_date: input.weddingDate || null,
        flexible_month: input.flexibleMonth || null,
        primary_city_id: input.primaryCityId || null,
        budget_min_minor: rupeesToMinor(input.budgetMinMinor) ?? null,
        budget_max_minor: rupeesToMinor(input.budgetMaxMinor) ?? null,
        guest_count: input.guestCount ?? null,
        notes: input.notes || null,
      },
      { onConflict: 'user_id' },
    )
    .select('id')
    .single()

  if (error || !profile) translate(error, 'We could not save your wedding profile.')

  // Replace the required-category set wholesale; it is a small list.
  await supabase.from('wedding_required_categories').delete().eq('wedding_profile_id', profile.id)

  if (input.requiredCategoryIds.length > 0) {
    const { error: catError } = await supabase.from('wedding_required_categories').insert(
      input.requiredCategoryIds.map((categoryId) => ({
        wedding_profile_id: profile.id,
        category_id: categoryId,
      })),
    )
    if (catError) translate(catError, 'We could not save the categories you need.')
  }

  return { id: profile.id }
}

export async function toggleShortlist(actor: Actor, vendorId: string, note?: string) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in to save vendors.')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('shortlists')
    .select('id')
    .eq('user_id', actor.userId)
    .eq('vendor_id', vendorId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('shortlists').delete().eq('id', existing.id)
    if (error) translate(error, 'We could not update your shortlist.')
    return { shortlisted: false }
  }

  const { error } = await supabase.from('shortlists').insert({
    user_id: actor.userId,
    vendor_id: vendorId,
    note: note || null,
  })
  if (error) translate(error, 'We could not update your shortlist.')
  return { shortlisted: true }
}

export async function updateShortlistNote(actor: Actor, vendorId: string, note: string) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in first.')
  const supabase = await createClient()

  const { error } = await supabase
    .from('shortlists')
    .update({ note: note || null })
    .eq('user_id', actor.userId)
    .eq('vendor_id', vendorId)

  if (error) translate(error, 'We could not save that note.')
  return { ok: true }
}

export async function markNotificationsRead(actor: Actor) {
  if (!actor.userId) return { ok: true }
  const supabase = await createClient()

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString(), status: 'read' })
    .eq('user_id', actor.userId)
    .is('read_at', null)

  return { ok: true }
}
