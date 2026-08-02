import { z } from 'zod'

/**
 * Review boundaries (PRD 6.8).
 *
 * These validate shape and give friendly messages. They are not the security
 * boundary: eligibility, moderation state, and the edit window are enforced by
 * triggers in migration `0018`, so a caller reaching PostgREST directly hits
 * the same rules.
 */

const rating = z.coerce
  .number()
  .int('Choose a whole number of stars.')
  .min(1, 'Choose at least one star.')
  .max(5, 'Five stars is the maximum.')

export const reviewSchema = z.object({
  enquiryId: z.uuid('Choose which enquiry this review is about.'),
  overallRating: rating,
  title: z
    .string()
    .trim()
    .max(120, 'Keep the title under 120 characters.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  body: z
    .string()
    .trim()
    .min(20, 'Please write at least 20 characters so it is useful to other couples.')
    .max(4000, 'Please keep the review under 4000 characters.'),
  /*
   * Blank must become `undefined` BEFORE the pattern runs. Chaining
   * `.regex(...).optional().transform(...)` validates first, so an untouched
   * optional date field failed with "Use the date picker." — the field is
   * optional, and leaving it empty is the common case.
   */
  eventDate: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.')
      .optional(),
  ),
})

export type ReviewInput = z.infer<typeof reviewSchema>

export const reviewEditSchema = reviewSchema.omit({ enquiryId: true }).extend({
  reviewId: z.uuid(),
})

export type ReviewEditInput = z.infer<typeof reviewEditSchema>

export const reviewResponseSchema = z.object({
  reviewId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(10, 'Please write at least 10 characters.')
    .max(2000, 'Please keep the response under 2000 characters.'),
})

export const reviewModerationSchema = z
  .object({
    reviewId: z.uuid(),
    decision: z.enum(['approved', 'rejected', 'flagged']),
    reason: z.string().trim().max(500).optional(),
  })
  // PRD 6.11: a moderator rejecting or flagging must say why. Approval needs no
  // justification, so the requirement is conditional rather than blanket.
  .refine((value) => value.decision === 'approved' || Boolean(value.reason), {
    path: ['reason'],
    message: 'Give a reason so the decision can be explained later.',
  })

export type ReviewModerationInput = z.infer<typeof reviewModerationSchema>
