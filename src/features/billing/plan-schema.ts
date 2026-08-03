import { z } from 'zod'

/**
 * Plan editing (PRD 6.10).
 *
 * The admin screen used to say pricing changes should go through a migration
 * "so the change is reviewable". That was a reasonable stance while nothing
 * could edit them, but it is not a substitute for the owner being able to
 * change a price — so this exists, with the reviewability moved into what the
 * form will and will not accept.
 *
 * Entitlements are eight known keys, not free-form JSON. A textarea would let a
 * typo reshape what every vendor on the plan is allowed to do, and
 * `vendor_may_be_featured()` reads this object in SQL — it would fail silently,
 * not loudly. Typed fields make an invalid shape unreachable.
 */

/** Blank means unlimited, which the entitlements object encodes as `null`. */
const quota = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.coerce.number().int().min(0).max(100_000).nullable(),
)

export const entitlementsSchema = z.object({
  listings: quota,
  categories: quota,
  media: quota,
  teamSize: quota,
  leadQuota: quota,
  analytics: z.boolean(),
  featured: z.boolean(),
  export: z.boolean(),
})

export const planFormSchema = z.object({
  id: z.uuid().optional(),
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]+$/, 'Lower-case letters, numbers, hyphens and underscores only.')
    .max(40),
  name: z.string().trim().min(2, 'Enter a name').max(80),
  billingInterval: z.enum(['monthly', 'yearly']),
  /*
   * Rupees in, minor units out. Money is integer minor units everywhere
   * (`lib/money`); accepting a float here and rounding later is how a price
   * ends up a paisa off.
   */
  amountMinor: z.preprocess((value) => {
    if (typeof value !== 'string' || value.trim() === '') return 0
    return Math.round(Number(value) * 100)
  }, z.number().int().min(0, 'A price cannot be negative').max(100_000_000)),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  trialDays: z.coerce.number().int().min(0).max(365).default(0),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
  entitlements: entitlementsSchema,
})

export type PlanFormInput = z.infer<typeof planFormSchema>
export type Entitlements = z.infer<typeof entitlementsSchema>
