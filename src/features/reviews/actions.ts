'use server'

import { revalidatePath } from 'next/cache'

import { runAction, type ActionResult } from '@/lib/action-result'
import { getActor } from '@/server/dal/actor'
import { assertPermission } from '@/lib/permissions'
import {
  createReview,
  moderateReview,
  moderateReviewResponse,
  respondToReview,
  updateReview,
} from '@/server/services/reviews'
import {
  reviewEditSchema,
  reviewModerationSchema,
  reviewResponseSchema,
  reviewSchema,
} from './schema'

/** Review actions (PRD 6.8). */

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function createReviewAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ reviewId: string }>> {
  const result = await runAction('reviews.create', async () => {
    const actor = await getActor()
    const input = reviewSchema.parse({
      enquiryId: str(form, 'enquiryId'),
      overallRating: str(form, 'overallRating'),
      title: str(form, 'title'),
      body: str(form, 'body'),
      eventDate: str(form, 'eventDate'),
    })
    return createReview(actor, input)
  })

  if (result.ok) revalidatePath('/account/reviews')
  return result
}

export async function updateReviewAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ reviewId: string; requiresModeration: boolean }>> {
  const result = await runAction('reviews.update', async () => {
    const actor = await getActor()
    const input = reviewEditSchema.parse({
      reviewId: str(form, 'reviewId'),
      overallRating: str(form, 'overallRating'),
      title: str(form, 'title'),
      body: str(form, 'body'),
      eventDate: str(form, 'eventDate'),
    })
    return updateReview(actor, input)
  })

  if (result.ok) {
    revalidatePath('/account/reviews')
    // The edit returns the review to moderation, so the public profile that was
    // showing it has to be rebuilt.
    const slug = str(form, 'vendorSlug')
    if (slug) revalidatePath(`/vendor/${slug}`)
  }
  return result
}

export async function respondToReviewAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ reviewId: string }>> {
  const result = await runAction('reviews.respond', async () => {
    const actor = await getActor()
    const input = reviewResponseSchema.parse({
      reviewId: str(form, 'reviewId'),
      body: str(form, 'body'),
    })
    return respondToReview(actor, input.reviewId, input.body)
  })

  if (result.ok) revalidatePath('/vendor-dashboard/reviews')
  return result
}

export async function moderateReviewAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ reviewId: string; decision: string }>> {
  const result = await runAction('reviews.moderate', async () => {
    const actor = await getActor()
    // Re-checked here even though RLS also enforces it: a UI that renders the
    // queue is not what decides who may act on it (CLAUDE.md invariant 2).
    assertPermission(actor, 'review.moderate')

    const input = reviewModerationSchema.parse({
      reviewId: str(form, 'reviewId'),
      decision: str(form, 'decision'),
      reason: str(form, 'reason') || undefined,
    })
    return moderateReview(actor, input)
  })

  if (result.ok) {
    revalidatePath('/admin/reviews')
    const slug = str(form, 'vendorSlug')
    if (slug) revalidatePath(`/vendor/${slug}`)
  }
  return result
}

export async function moderateReviewResponseAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ responseId: string; decision: string }>> {
  const result = await runAction('reviews.moderateResponse', async () => {
    const actor = await getActor()
    assertPermission(actor, 'review.moderate')

    const responseId = str(form, 'responseId')
    const decision = str(form, 'decision')
    if (decision !== 'approved' && decision !== 'rejected') {
      throw new Error('Unknown decision')
    }
    return moderateReviewResponse(actor, responseId, decision, str(form, 'reason') || undefined)
  })

  if (result.ok) revalidatePath('/admin/reviews')
  return result
}
