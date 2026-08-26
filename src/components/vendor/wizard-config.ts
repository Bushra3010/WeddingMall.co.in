import {
  Building2,
  FileText,
  Images,
  MapPin,
  Send,
  ShieldCheck,
  Tags,
  type LucideIcon,
} from 'lucide-react'

import type { VendorWorkspace } from '@/server/dal/vendor-workspace'

/**
 * The seven steps of vendor onboarding, declared once.
 *
 * Navigation, the stepper, the progress line and the review screen all read
 * this array, so adding or reordering a step is one edit rather than seven.
 */

export type StepKey =
  'business' | 'about' | 'categories' | 'areas' | 'media' | 'documents' | 'submit'

export type StepDefinition = {
  id: StepKey
  /** Short label, used in the stepper and the review list. */
  label: string
  /** Sentence shown above the form, so the ask is clear before any field is. */
  headline: string
  description: string
  icon: LucideIcon
}

export const STEPS: StepDefinition[] = [
  {
    id: 'business',
    label: 'Business',
    headline: "Let's start with your business",
    description: 'Tell us your business details. You can edit anything later.',
    icon: Building2,
  },
  {
    id: 'about',
    label: 'About',
    headline: 'Tell couples your story',
    description: 'What you do, how you work, and what makes you worth booking.',
    icon: FileText,
  },
  {
    id: 'categories',
    label: 'Categories',
    headline: 'What do you offer?',
    description: 'Pick the specialties couples should find you under.',
    icon: Tags,
  },
  {
    id: 'areas',
    label: 'Areas',
    headline: 'Where do you work?',
    description: 'The cities you cover, so you only hear from couples you can serve.',
    icon: MapPin,
  },
  {
    id: 'media',
    label: 'Media',
    headline: 'Show your work',
    description: 'Photographs are the first thing couples look at. Three is the minimum.',
    icon: Images,
  },
  {
    id: 'documents',
    label: 'Documents',
    headline: 'Verify your business',
    description: 'Submitted once, never shown publicly, and used only to verify you.',
    icon: ShieldCheck,
  },
  {
    id: 'submit',
    label: 'Submit',
    headline: 'Review and go live',
    description: 'Check everything over, then send it to our team for approval.',
    icon: Send,
  },
]

export const STEP_INDEX: Record<StepKey, number> = STEPS.reduce(
  (acc, step, index) => ({ ...acc, [step.id]: index }),
  {} as Record<StepKey, number>,
)

/**
 * Whether a step's data is already saved.
 *
 * Derived from the vendor record rather than tracked in component state, so a
 * reload, a second device, or coming back a week later all show the same
 * ticks. Client-only progress would look right until the page refreshed.
 */
export function isStepComplete(step: StepKey, vendor: VendorWorkspace): boolean {
  const fields = vendor.completion.fields
  const done = (key: string) => fields.find((f) => f.key === key)?.done ?? false

  switch (step) {
    case 'business':
      return Boolean(vendor.displayName?.trim()) && Boolean(vendor.primaryCityId)
    case 'about':
      return (vendor.about?.trim().length ?? 0) >= 50
    case 'categories':
      return done('categories')
    case 'areas':
      return done('serviceAreas')
    case 'media':
      return vendor.mediaCount >= 3
    case 'documents':
      return vendor.documentCount > 0
    case 'submit':
      /*
       * Submitted, not merely submittable.
       *
       * `canSubmit` means the required fields are filled — it was showing a tick
       * on Submit while Documents still sat locked, which reads as "you already
       * finished the last step but not the one before it". A step is only done
       * once the vendor has actually sent the listing for review.
       */
      return Boolean(vendor.submittedAt) || vendor.status !== 'draft'
    default:
      return false
  }
}

/**
 * Which steps a vendor may open.
 *
 * Everything up to and including the first unfinished step is reachable, plus
 * anything already finished. That keeps the path forward obvious without
 * trapping someone who completed step five and wants to fix step two.
 *
 * Submit is the exception: it stays locked until the listing can actually be
 * submitted, because opening a review screen that refuses to submit is a dead
 * end dressed as progress.
 */
export function isStepUnlocked(step: StepKey, vendor: VendorWorkspace): boolean {
  if (step === 'submit') return vendor.completion.canSubmit

  /*
   * Once the listing is submittable, nothing earlier stays gated.
   *
   * Media and documents count towards a complete profile but are not required
   * to submit, so a vendor could reach `canSubmit` with neither — which left
   * Documents showing a padlock while Submit sat open beside it. Locking a step
   * the user has already effectively passed reads as a bug, and the gate has
   * nothing left to protect at that point.
   */
  if (vendor.completion.canSubmit) return true
  if (isStepComplete(step, vendor)) return true

  const firstIncomplete = STEPS.find((s) => !isStepComplete(s.id, vendor))
  return firstIncomplete ? STEP_INDEX[step] <= STEP_INDEX[firstIncomplete.id] : true
}
