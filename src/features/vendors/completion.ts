/**
 * Listing completion score (PRD 6.9 — "completion score uses configurable
 * weighted fields").
 *
 * Pure and dependency-free so it can be unit-tested and rendered on both the
 * server and the client. It drives guidance only; the hard gate on submission
 * lives in `submit_vendor_for_review()` and cannot be bypassed from the UI.
 */

export interface CompletionInput {
  displayName: string | null
  primaryCityId: string | null
  categoryCount: number
  serviceAreaCount: number
  about: string | null
  experienceYears: number | null
  phone: string | null
  email: string | null
  website: string | null
  packageCount: number
  mediaCount: number
  documentCount: number
}

export interface CompletionField {
  key: string
  label: string
  weight: number
  done: boolean
  /** Blocks submission when incomplete — mirrors the SQL gate. */
  required: boolean
  hint: string
}

export interface CompletionResult {
  score: number
  fields: CompletionField[]
  missingRequired: CompletionField[]
  canSubmit: boolean
}

const MIN_ABOUT_LENGTH = 50
const RECOMMENDED_MEDIA = 3

export function calculateCompletion(input: CompletionInput): CompletionResult {
  const fields: CompletionField[] = [
    {
      key: 'displayName',
      label: 'Business name',
      weight: 8,
      required: true,
      done: Boolean(input.displayName?.trim()),
      hint: 'The name couples will see on your profile.',
    },
    {
      key: 'city',
      label: 'Primary city',
      weight: 8,
      required: true,
      done: Boolean(input.primaryCityId),
      hint: 'Where your business is based.',
    },
    {
      key: 'categories',
      label: 'Category',
      weight: 10,
      required: true,
      done: input.categoryCount > 0,
      hint: 'Pick the category couples would search for you under.',
    },
    {
      key: 'serviceAreas',
      label: 'Service areas',
      weight: 8,
      required: true,
      done: input.serviceAreaCount > 0,
      hint: 'The cities you are willing to work in.',
    },
    {
      key: 'about',
      label: 'About your business',
      weight: 15,
      required: true,
      done: (input.about?.trim().length ?? 0) >= MIN_ABOUT_LENGTH,
      hint: `At least ${MIN_ABOUT_LENGTH} characters describing what you offer.`,
    },
    {
      key: 'packages',
      label: 'At least one package',
      weight: 12,
      required: false,
      done: input.packageCount > 0,
      hint: 'Listings with pricing receive noticeably more enquiries.',
    },
    {
      key: 'media',
      label: `At least ${RECOMMENDED_MEDIA} photos`,
      weight: 15,
      required: false,
      done: input.mediaCount >= RECOMMENDED_MEDIA,
      hint: 'Your portfolio is the first thing couples look at.',
    },
    {
      key: 'documents',
      label: 'Verification document',
      weight: 6,
      required: false,
      done: input.documentCount > 0,
      hint: 'Needed for the verified badge. Stored privately.',
    },
    {
      key: 'experience',
      label: 'Years in business',
      weight: 5,
      required: false,
      done: input.experienceYears !== null && input.experienceYears >= 0,
      hint: 'Helps couples judge experience.',
    },
    {
      key: 'phone',
      label: 'Contact phone',
      weight: 5,
      required: false,
      done: Boolean(input.phone?.trim()),
      hint: 'Never shown publicly — used to reach you about enquiries.',
    },
    {
      key: 'email',
      label: 'Contact email',
      weight: 5,
      required: false,
      done: Boolean(input.email?.trim()),
      hint: 'Where enquiry notifications are sent.',
    },
    {
      key: 'website',
      label: 'Website',
      weight: 3,
      required: false,
      done: Boolean(input.website?.trim()),
      hint: 'Optional, but adds credibility.',
    },
  ]

  const total = fields.reduce((sum, field) => sum + field.weight, 0)
  const earned = fields.reduce((sum, field) => sum + (field.done ? field.weight : 0), 0)
  const missingRequired = fields.filter((field) => field.required && !field.done)

  return {
    // Weights sum to 100 today, but normalise so adding a field cannot push
    // the score past 100.
    score: total === 0 ? 0 : Math.round((earned / total) * 100),
    fields,
    missingRequired,
    canSubmit: missingRequired.length === 0,
  }
}

/** The single next thing worth doing (PRD 6.9 — "next recommended action"). */
export function nextAction(result: CompletionResult): CompletionField | null {
  const required = result.missingRequired[0]
  if (required) return required
  const optional = result.fields
    .filter((field) => !field.done)
    .sort((a, b) => b.weight - a.weight)[0]
  return optional ?? null
}
