import { z } from 'zod'

import { VENDOR_ROLES } from '@/lib/permissions'

/** Zod at every mutation boundary (PRD 10.3, CLAUDE.md). */

const trimmed = (max: number) => z.string().trim().max(max)

export const vendorSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Use at least 3 characters')
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only')

export const createVendorSchema = z.object({
  displayName: trimmed(120).min(2, 'Enter your business name'),
  primaryCityId: z.uuid('Choose your primary city'),
  primaryCategoryId: z.uuid('Choose a category'),
})

export const vendorProfileSchema = z.object({
  displayName: trimmed(120).min(2, 'Enter your business name'),
  legalName: trimmed(160).optional().or(z.literal('')),
  primaryCityId: z.uuid('Choose your primary city'),
  email: z.email('Enter a valid email').max(254).optional().or(z.literal('')),
  phone: trimmed(20)
    .regex(/^[+()\d\s-]*$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  website: z.url('Enter a full URL including https://').max(300).optional().or(z.literal('')),
  foundedYear: z.coerce
    .number()
    .int()
    .min(1900, 'Enter a year after 1900')
    .max(new Date().getFullYear(), 'That year is in the future')
    .optional(),
})

export const vendorListingSchema = z.object({
  about: trimmed(4000).min(50, 'Write at least 50 characters'),
  experienceYears: z.coerce.number().int().min(0).max(200).optional(),
  languages: z.array(trimmed(40)).max(12).default([]),
})

export const serviceAreaSchema = z.object({
  cityIds: z.array(z.uuid()).min(1, 'Choose at least one city').max(40),
  travelAvailable: z.boolean().default(false),
})

export const categorySelectionSchema = z.object({
  primaryCategoryId: z.uuid('Choose a primary category'),
  additionalCategoryIds: z.array(z.uuid()).max(5).default([]),
})

export const inviteMemberSchema = z.object({
  email: z.email('Enter a valid email address').max(254).toLowerCase(),
  role: z.enum(VENDOR_ROLES).refine((role) => role !== 'vendor_owner' || true, {
    message: 'Invalid role',
  }),
})

export const memberRoleSchema = z.object({
  membershipId: z.uuid(),
  role: z.enum(VENDOR_ROLES),
})

/**
 * Verification uploads. MIME and size are re-checked server-side; the storage
 * bucket enforces its own limits as a third layer (PRD 10.3).
 */
export const ALLOWED_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

export const DOCUMENT_KINDS = [
  { value: 'business_registration', label: 'Business registration' },
  { value: 'gst', label: 'GST certificate' },
  { value: 'pan', label: 'PAN card' },
  { value: 'identity', label: 'Owner identity document' },
  { value: 'address_proof', label: 'Address proof' },
  { value: 'other', label: 'Other supporting document' },
] as const

export const uploadDocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_KINDS.map((d) => d.value) as [string, ...string[]]),
})

export const ADMIN_DECISIONS = [
  'approve',
  'request_changes',
  'reject',
  'suspend',
  'reactivate',
] as const

export type AdminDecision = (typeof ADMIN_DECISIONS)[number]

export const adminDecisionSchema = z
  .object({
    vendorId: z.uuid(),
    decision: z.enum(ADMIN_DECISIONS),
    reason: trimmed(1000).optional().or(z.literal('')),
  })
  // Mirrors the SQL guard: every decision except approval needs a reason the
  // vendor can act on (PRD 6.11, Epic E).
  .refine((value) => value.decision === 'approve' || Boolean(value.reason?.trim()), {
    message: 'A reason is required for this decision',
    path: ['reason'],
  })

export const categoryFormSchema = z.object({
  id: z.uuid().optional(),
  name: trimmed(80).min(2, 'Enter a name'),
  slug: vendorSlugSchema,
  description: trimmed(400).optional().or(z.literal('')),
  parentId: z.uuid().optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
})

export const cityFormSchema = z.object({
  id: z.uuid().optional(),
  stateId: z.uuid('Choose a state'),
  name: trimmed(80).min(2, 'Enter a name'),
  slug: vendorSlugSchema,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
})

export type CreateVendorInput = z.infer<typeof createVendorSchema>
export type VendorProfileInput = z.infer<typeof vendorProfileSchema>
export type AdminDecisionInput = z.infer<typeof adminDecisionSchema>

/** Slug candidate from a business name; uniqueness is settled by the service. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
