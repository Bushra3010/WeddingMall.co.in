import { z } from 'zod'

/** Listing, package, media, and availability validation (PRD 6.9, 10.3). */

const trimmed = (max: number) => z.string().trim().max(max)

export const PRICE_TYPES = [
  { value: 'starting_at', label: 'Starting at' },
  { value: 'fixed', label: 'Fixed price' },
  { value: 'range', label: 'Price range' },
  { value: 'custom', label: 'On request' },
] as const

export type PriceType = (typeof PRICE_TYPES)[number]['value']

/**
 * Prices arrive as major units from the form and are converted to integer minor
 * units by the service. `range` needs both bounds; `custom` needs none.
 */
export const packageSchema = z
  .object({
    id: z.uuid().optional(),
    name: trimmed(120).min(2, 'Give the package a name'),
    description: trimmed(1000).optional().or(z.literal('')),
    categoryId: z.uuid().optional().or(z.literal('')),
    priceType: z.enum(PRICE_TYPES.map((p) => p.value) as [PriceType, ...PriceType[]]),
    minAmount: z.coerce.number().min(0).max(1_000_000_000).optional(),
    maxAmount: z.coerce.number().min(0).max(1_000_000_000).optional(),
    currency: z.string().length(3).default('INR'),
    unit: trimmed(40).optional().or(z.literal('')),
    inclusions: z.array(trimmed(120)).max(30).default([]),
    exclusions: z.array(trimmed(120)).max(30).default([]),
    active: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  })
  .refine((v) => v.priceType !== 'range' || (v.minAmount != null && v.maxAmount != null), {
    message: 'A price range needs both a minimum and a maximum',
    path: ['maxAmount'],
  })
  .refine((v) => v.minAmount == null || v.maxAmount == null || v.minAmount <= v.maxAmount, {
    message: 'The maximum must be at least the minimum',
    path: ['maxAmount'],
  })
  .refine((v) => v.priceType === 'custom' || v.minAmount != null, {
    message: 'Enter a price, or choose "On request"',
    path: ['minAmount'],
  })

export type PackageInput = z.infer<typeof packageSchema>

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export const mediaUploadSchema = z.object({
  altText: trimmed(160).optional().or(z.literal('')),
})

export const mediaUpdateSchema = z.object({
  mediaId: z.uuid(),
  altText: trimmed(160).optional().or(z.literal('')),
})

export const AVAILABILITY_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
  { value: 'unavailable', label: 'Unavailable' },
] as const

export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number]['value']

export const availabilitySchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a start date'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose an end date'),
    status: z.enum(
      AVAILABILITY_STATUSES.map((s) => s.value) as [AvailabilityStatus, ...AvailabilityStatus[]],
    ),
    note: trimmed(300).optional().or(z.literal('')),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: 'The end date cannot be before the start date',
    path: ['endDate'],
  })

export const LISTING_DECISIONS = ['approve', 'request_changes', 'reject'] as const
export type ListingDecision = (typeof LISTING_DECISIONS)[number]

export const listingDecisionSchema = z
  .object({
    versionId: z.uuid(),
    decision: z.enum(LISTING_DECISIONS),
    reason: trimmed(1000).optional().or(z.literal('')),
  })
  .refine((v) => v.decision === 'approve' || Boolean(v.reason?.trim()), {
    message: 'A reason is required for this decision',
    path: ['reason'],
  })

export const attributeDefinitionSchema = z.object({
  id: z.uuid().optional(),
  categoryId: z.uuid('Choose a category'),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores'),
  label: trimmed(80).min(2, 'Enter a label'),
  inputType: z.enum(['text', 'number', 'select', 'multiselect', 'boolean', 'range']),
  dataType: z.enum(['string', 'number', 'boolean', 'array']),
  unit: trimmed(20).optional().or(z.literal('')),
  filterable: z.boolean().default(false),
  required: z.boolean().default(false),
  options: z.array(trimmed(80)).max(60).default([]),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
})

/** Splits a textarea of one-per-line values into a trimmed list. */
export function linesToList(value: string, max = 30): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max)
}
