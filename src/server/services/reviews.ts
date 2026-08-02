import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ServiceError } from '@/lib/action-result'
import { type Actor } from '@/lib/permissions'
import type { ReviewEditInput, ReviewInput, ReviewModerationInput } from '@/features/reviews/schema'

/**
 * Review services (PRD 6.8).
 *
 * Eligibility, the edit window, moderation-field immutability, and revision
 * history are all enforced by triggers (migration `0018`). These wrappers
 * exist to turn the database's error codes into something a person can act on
 * — they are not the place the rules live, and duplicating the rules here
 * would create a second answer to "may this be published".
 */

function translate(error: { code?: string; message?: string } | null, fallback: string): never {
  // 42501 is what the integrity triggers raise for a denied write.
  if (error?.code === '42501' || error?.code === 'P0001') {
    throw new ServiceError('forbidden', error.message ?? fallback)
  }
  if (error?.code === '23505') {
    throw new ServiceError('conflict', 'You have already reviewed this enquiry.')
  }
  if (error?.code === '23503') {
    throw new ServiceError('not_found', 'That enquiry no longer exists.')
  }
  throw new ServiceError('internal_error', fallback)
}

export async function createReview(actor: Actor, input: ReviewInput) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in to leave a review.')

  const supabase = await createClient()

  // The vendor is taken from the enquiry rather than the form: accepting it
  // from the client would let a caller aim a review at a different business,
  // and the trigger would then have to reject a request we should never send.
  const { data: enquiry, error: lookupError } = await supabase
    .from('enquiries')
    .select('id, vendor_id, customer_id, status')
    .eq('id', input.enquiryId)
    .maybeSingle()

  if (lookupError) translate(lookupError, 'Could not load that enquiry.')
  if (!enquiry) throw new ServiceError('not_found', 'That enquiry could not be found.')

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      enquiry_id: enquiry.id,
      customer_id: actor.userId,
      vendor_id: enquiry.vendor_id,
      overall_rating: input.overallRating,
      title: input.title ?? null,
      body: input.body,
      event_date: input.eventDate ?? null,
    })
    .select('id')
    .single()

  if (error) translate(error, 'Could not save your review.')
  return { reviewId: data.id }
}

export async function updateReview(actor: Actor, input: ReviewEditInput) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('reviews')
    .update({
      overall_rating: input.overallRating,
      title: input.title ?? null,
      body: input.body,
      event_date: input.eventDate ?? null,
    })
    .eq('id', input.reviewId)

  // The trigger returns the review to `pending` and files a revision; saying so
  // here avoids a customer wondering why their edit vanished from the profile.
  if (error) translate(error, 'Could not update your review.')
  return { reviewId: input.reviewId, requiresModeration: true }
}

export async function respondToReview(actor: Actor, reviewId: string, body: string) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

  const supabase = await createClient()

  const { data: review, error: lookupError } = await supabase
    .from('reviews')
    .select('id, vendor_id')
    .eq('id', reviewId)
    .maybeSingle()

  if (lookupError) translate(lookupError, 'Could not load that review.')
  if (!review) throw new ServiceError('not_found', 'That review could not be found.')

  // One response per review is a database constraint (`unique (review_id)`),
  // so an upsert is the honest expression of "edit your single reply".
  const { error } = await supabase.from('review_responses').upsert(
    {
      review_id: review.id,
      vendor_id: review.vendor_id,
      author_user_id: actor.userId,
      body,
    },
    { onConflict: 'review_id' },
  )

  if (error) translate(error, 'Could not save your response.')
  return { reviewId: review.id }
}

export async function moderateReview(actor: Actor, input: ReviewModerationInput) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('reviews')
    .update({
      status: input.decision,
      moderation_reason: input.reason ?? null,
      reviewer_id: actor.userId,
    })
    .eq('id', input.reviewId)

  if (error) translate(error, 'Could not record that decision.')
  return { reviewId: input.reviewId, decision: input.decision }
}

export async function moderateReviewResponse(
  actor: Actor,
  responseId: string,
  decision: 'approved' | 'rejected',
  reason?: string,
) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('review_responses')
    .update({ status: decision })
    .eq('id', responseId)

  if (error) translate(error, 'Could not record that decision.')
  return { responseId, decision, reason }
}
