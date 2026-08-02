import { z } from 'zod'

import { ENQUIRY_STATUSES } from './status'

/** Enquiry, wedding profile, shortlist, and message validation (PRD 6.5–6.7). */

const trimmed = (max: number) => z.string().trim().max(max)

export const CONTACT_MODES = [
  { value: 'in_app', label: 'Messages here only' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone call' },
  { value: 'whatsapp', label: 'WhatsApp' },
] as const

export const enquirySchema = z
  .object({
    vendorId: z.uuid(),
    categoryId: z.uuid().optional().or(z.literal('')),
    cityId: z.uuid().optional().or(z.literal('')),
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
      .optional()
      .or(z.literal('')),
    flexibleDate: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'Choose a month')
      .optional()
      .or(z.literal('')),
    budgetMinMinor: z.coerce.number().int().min(0).optional(),
    budgetMaxMinor: z.coerce.number().int().min(0).optional(),
    guestCount: z.coerce.number().int().min(0).max(100000).optional(),
    message: trimmed(2000).min(20, 'Tell them a little about what you need (20+ characters)'),
    preferredContactMode: z
      .enum(CONTACT_MODES.map((m) => m.value) as [string, ...string[]])
      .default('in_app'),
    /**
     * Explicit, opt-in, and never defaulted true (PRD 6.6, 2.3 — a vendor must
     * not receive customer contact details without consent).
     */
    contactConsent: z.boolean().default(false),
    idempotencyKey: z.uuid(),
  })
  .refine(
    (v) =>
      v.budgetMinMinor == null || v.budgetMaxMinor == null || v.budgetMinMinor <= v.budgetMaxMinor,
    { message: 'The maximum budget must be at least the minimum', path: ['budgetMaxMinor'] },
  )

export type EnquiryInput = z.infer<typeof enquirySchema>

export const weddingProfileSchema = z
  .object({
    displayLabel: trimmed(120).optional().or(z.literal('')),
    weddingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal('')),
    flexibleMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .or(z.literal('')),
    primaryCityId: z.uuid().optional().or(z.literal('')),
    budgetMinMinor: z.coerce.number().int().min(0).optional(),
    budgetMaxMinor: z.coerce.number().int().min(0).optional(),
    guestCount: z.coerce.number().int().min(0).max(100000).optional(),
    notes: trimmed(2000).optional().or(z.literal('')),
    requiredCategoryIds: z.array(z.uuid()).max(20).default([]),
  })
  .refine(
    (v) =>
      v.budgetMinMinor == null || v.budgetMaxMinor == null || v.budgetMinMinor <= v.budgetMaxMinor,
    { message: 'The maximum budget must be at least the minimum', path: ['budgetMaxMinor'] },
  )

export const shortlistSchema = z.object({
  vendorId: z.uuid(),
  note: trimmed(500).optional().or(z.literal('')),
})

export const messageSchema = z.object({
  enquiryId: z.uuid(),
  body: trimmed(5000).min(1, 'Write a message first'),
})

export const transitionSchema = z.object({
  enquiryId: z.uuid(),
  status: z.enum(ENQUIRY_STATUSES),
  reason: trimmed(500).optional().or(z.literal('')),
})

/**
 * Budget inputs arrive in whole rupees. Kept here rather than in the form so
 * the boundary always produces integer minor units (CLAUDE.md invariant 5).
 */
export function rupeesToMinor(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value)) return undefined
  return Math.round(value * 100)
}

export function minorToRupees(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  return Math.round(value / 100)
}

/**
 * Vendor CRM fields (PRD 6.9 "Enquiry CRM").
 *
 * `quoteAmount` is entered in whole rupees and stored in minor units — money
 * is never a float in this codebase (CLAUDE.md invariant 5).
 */
export const enquiryNoteSchema = z.object({
  enquiryId: z.uuid(),
  note: z
    .string()
    .trim()
    .min(1, 'Write something before saving.')
    .max(2000, 'Keep notes under 2000 characters.'),
  followUpAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
})

export const enquiryCrmSchema = z.object({
  enquiryId: z.uuid(),
  /*
   * `preprocess` must run before coercion, not after: `z.coerce.number()`
   * turns '' into 0, so an `.or(z.literal(''))` branch is unreachable and a
   * blank field would record a quote of zero rupees rather than no quote.
   * Caught by tests/review-schema.test.ts.
   */
  quoteAmount: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.coerce.number().min(0, 'A quote cannot be negative.').optional(),
  ),
  lostReason: z
    .string()
    .trim()
    .max(500, 'Keep the reason under 500 characters.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
})

export type EnquiryNoteInput = z.infer<typeof enquiryNoteSchema>
export type EnquiryCrmInput = z.infer<typeof enquiryCrmSchema>
