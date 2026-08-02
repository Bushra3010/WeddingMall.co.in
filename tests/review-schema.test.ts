import { describe, expect, it } from 'vitest'

import {
  reviewModerationSchema,
  reviewResponseSchema,
  reviewSchema,
} from '@/features/reviews/schema'
import { enquiryCrmSchema, enquiryNoteSchema } from '@/features/enquiries/schema'

/**
 * These cover the boundary rules that are cheap to get wrong and expensive to
 * notice: the conditional reason on moderation, and the coercions that decide
 * whether a blank field means "clear this" or "leave it alone".
 *
 * They are not the security boundary — eligibility, the edit window, and
 * moderation immutability live in triggers and are exercised by
 * `scripts/rls-review-probe.mjs` against the real database.
 */

const validReview = {
  enquiryId: '11111111-1111-4111-8111-111111111111',
  overallRating: '5',
  body: 'They were wonderful from the first call to the final dance.',
}

describe('reviewSchema', () => {
  it('accepts a well-formed review', () => {
    const parsed = reviewSchema.parse(validReview)
    expect(parsed.overallRating).toBe(5)
  })

  it('coerces the rating from the string a form submits', () => {
    expect(reviewSchema.parse({ ...validReview, overallRating: '3' }).overallRating).toBe(3)
  })

  it.each([['0'], ['6'], ['2.5'], ['not a number']])('rejects rating %s', (rating) => {
    expect(() => reviewSchema.parse({ ...validReview, overallRating: rating })).toThrow()
  })

  it('rejects a body too short to help anyone', () => {
    expect(() => reviewSchema.parse({ ...validReview, body: 'Great!' })).toThrow()
  })

  it('treats an empty optional field as absent rather than as an empty string', () => {
    const parsed = reviewSchema.parse({ ...validReview, title: '', eventDate: '' })
    expect(parsed.title).toBeUndefined()
    expect(parsed.eventDate).toBeUndefined()
  })

  it('rejects a malformed event date', () => {
    expect(() => reviewSchema.parse({ ...validReview, eventDate: '12/05/2026' })).toThrow()
  })
})

describe('reviewModerationSchema', () => {
  const reviewId = '22222222-2222-4222-8222-222222222222'

  it('approves without a reason', () => {
    expect(reviewModerationSchema.parse({ reviewId, decision: 'approved' }).decision).toBe(
      'approved',
    )
  })

  // PRD 6.11: a negative decision has to be explainable after the fact.
  it.each([['rejected'], ['flagged']])('requires a reason to %s', (decision) => {
    expect(() => reviewModerationSchema.parse({ reviewId, decision })).toThrow()
    expect(
      reviewModerationSchema.parse({ reviewId, decision, reason: 'Contains personal data' })
        .decision,
    ).toBe(decision)
  })

  it('rejects a decision outside the allowed set', () => {
    expect(() =>
      reviewModerationSchema.parse({ reviewId, decision: 'archived', reason: 'x' }),
    ).toThrow()
  })
})

describe('reviewResponseSchema', () => {
  const reviewId = '33333333-3333-4333-8333-333333333333'

  it('rejects a reply that is only whitespace', () => {
    expect(() => reviewResponseSchema.parse({ reviewId, body: '          ' })).toThrow()
  })

  it('trims before measuring length', () => {
    const parsed = reviewResponseSchema.parse({ reviewId, body: '  Thank you kindly!  ' })
    expect(parsed.body).toBe('Thank you kindly!')
  })
})

describe('enquiry CRM schemas', () => {
  const enquiryId = '44444444-4444-4444-8444-444444444444'

  it('requires a note to have content', () => {
    expect(() => enquiryNoteSchema.parse({ enquiryId, note: '   ' })).toThrow()
  })

  it('treats a blank follow-up date as no date', () => {
    expect(
      enquiryNoteSchema.parse({ enquiryId, note: 'Call Tuesday', followUpAt: '' }).followUpAt,
    ).toBeUndefined()
  })

  it('leaves an unsubmitted quote undefined so the update skips the column', () => {
    const parsed = enquiryCrmSchema.parse({ enquiryId, quoteAmount: '', lostReason: '' })
    expect(parsed.quoteAmount).toBeUndefined()
    expect(parsed.lostReason).toBeUndefined()
  })

  it('coerces a submitted quote to a number', () => {
    expect(enquiryCrmSchema.parse({ enquiryId, quoteAmount: '125000' }).quoteAmount).toBe(125000)
  })

  it('rejects a negative quote', () => {
    expect(() => enquiryCrmSchema.parse({ enquiryId, quoteAmount: '-1' })).toThrow()
  })
})
