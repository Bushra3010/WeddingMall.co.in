import {
  Building2,
  FileText,
  Images,
  Landmark,
  MapPin,
  Send,
  ShieldCheck,
  Tags,
  type LucideIcon,
} from 'lucide-react'

import type { VendorWorkspace } from '@/server/dal/vendor-workspace'

/**
 * The eight steps of vendor onboarding, declared once.
 *
 * Navigation, the stepper, the progress line and the review screen all read
 * this array, so adding or reordering a step is one edit rather than eight.
 */

export type StepKey =
  'business' | 'about' | 'categories' | 'areas' | 'media' | 'documents' | 'bank' | 'submit'

export type StepDefinition = {
  id: StepKey
  /** Short label, used in the stepper and the review list. */
  label: string
  /** Sentence shown above the form, so the ask is clear before any field is. */
  headline: string
  description: string
  icon: LucideIcon
  /**
   * Not required to submit, and said so on the review screen.
   *
   * Without this the review list reads "Not finished yet" beside a step nobody
   * has to finish, which is the wizard telling a vendor they are blocked when
   * they are not. Only Bank carries it: Media and Documents are optional to the
   * *gate* but are what the profile is judged on, so nudging there is wanted.
   */
  optional?: boolean
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
    id: 'bank',
    label: 'Bank',
    headline: 'Where should we send your money?',
    description: 'Account details and a cancelled cheque. Private, and never shown to couples.',
    icon: Landmark,
    optional: true,
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
    case 'bank':
      /*
       * `bankAccount` is null both for "none entered" and for "you may not see
       * it" — RLS restricts the row to `billing.manage`, the owner alone. So a
       * manager sees this step as unfinished for a business that has details on
       * file. Acceptable precisely because the step is optional: it never gates
       * anything, and the step itself explains that only the owner can look.
       *
       * `Boolean(...)`, not `!== null`. The strict form was wrong for a shape
       * where the key is *absent* rather than null — `undefined !== null` is
       * true, so a brand-new vendor read as having payout details on file, and
       * Bank showed unlocked with every step before it still padlocked. Caught
       * by the prefix assertion in `wizard-steps.test.ts`.
       */
      return Boolean(vendor.bankAccount)
    case 'submit':
      /*
       * Submitted *and* submittable — both halves are load-bearing.
       *
       * `canSubmit` alone means the required fields are filled; that showed a
       * tick on Submit while Documents still sat locked, which reads as "you
       * already finished the last step but not the one before it".
       *
       * The status check alone is now wrong in the other direction. Since
       * migration 0035 a registration *opens* at `pending_review` with a
       * `submitted_at`, so "not a draft" would tick the final step for someone
       * who has written nothing at all — congratulating a brand-new vendor on
       * finishing the form they have not started.
       */
      return (
        vendor.completion.canSubmit && (Boolean(vendor.submittedAt) || vendor.status !== 'draft')
      )
    default:
      return false
  }
}

/**
 * Which steps a vendor may open.
 *
 * Everything up to and including whichever is further of: the first unfinished
 * step, and the last finished one. That keeps the path forward obvious without
 * trapping someone who completed step five and wants to fix step two, and it
 * guarantees the unlocked steps are a contiguous prefix — see the note in the
 * body for why taking the furthest of the two is what makes both true at once.
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

  /*
   * Unlocked steps must be a **prefix**. That is the property the rail is read
   * against: a padlock means "not yet", and one open step sitting past a locked
   * one says the opposite of what the padlock before it says.
   *
   * Two intents have to hold at once, and the obvious pair of rules for them
   * contradicts each other:
   *
   *   - reach the first thing you have not done   → unlock up to the frontier
   *   - go back to anything you have done         → unlock every complete step
   *
   * The second breaks the prefix on its own whenever a *later* step is complete
   * while an earlier one is not. That is not hypothetical: Bank is optional and
   * sits second-to-last, so filling it early — or completing Areas and then
   * clearing About — produced exactly that vector. The earlier version of this
   * function returned `true` for any complete step and did break, which the
   * prefix assertion in `wizard-steps.test.ts` caught.
   *
   * Taking the furthest of the two limits satisfies both by construction.
   * Unlocking an earlier incomplete step costs nothing — the only step that
   * must stay shut until the listing is ready is Submit, and that is decided
   * above, on `canSubmit`, not here.
   */
  const frontier = STEPS.findIndex((s) => !isStepComplete(s.id, vendor))
  const lastComplete = STEPS.reduce(
    (furthest, s, index) => (isStepComplete(s.id, vendor) ? index : furthest),
    -1,
  )

  const limit = Math.max(frontier === -1 ? STEPS.length - 1 : frontier, lastComplete)
  return STEP_INDEX[step] <= limit
}

/**
 * Which step the wizard opens on.
 *
 * The first unfinished step, **skipping optional ones**. Bank is optional and
 * most vendors never fill it, so without the skip a business whose listing is
 * complete and live would land on Bank every single time it opened the listing
 * editor — a screen it has already decided not to use, in front of the sections
 * it came to edit.
 *
 * If everything required is done, it opens on the first optional step that is
 * still empty, and only then falls back to the beginning. So the nudge happens
 * once the real work is finished rather than instead of it.
 */
export function initialStep(vendor: VendorWorkspace): StepKey {
  const required = STEPS.find((s) => !s.optional && !isStepComplete(s.id, vendor))
  if (required) return required.id

  const optional = STEPS.find((s) => s.optional && !isStepComplete(s.id, vendor))
  return optional?.id ?? 'business'
}
