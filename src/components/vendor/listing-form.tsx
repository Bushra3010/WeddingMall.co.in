'use client'

import { useCallback, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Pencil } from 'lucide-react'

import {
  WizardAboutStep,
  WizardAreasStep,
  WizardBusinessStep,
  WizardCategoriesStep,
  WizardDocumentsStep,
  WizardMediaStep,
  WizardSubmitStep,
} from '@/components/vendor/wizard-steps'
import {
  isStepComplete,
  isStepUnlocked,
  STEPS,
  STEP_INDEX,
  type StepKey,
} from '@/components/vendor/wizard-config'
import { WizardProgress, WizardStepper } from '@/components/vendor/wizard-stepper'
import { cn } from '@/lib/utils'
import type { VendorWorkspace, VerificationDocument } from '@/server/dal/vendor-workspace'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

/**
 * Vendor listing onboarding: the whole journey visible, one form at a time.
 *
 * Replaces a single page that stacked all seven sections. Seeing every field at
 * once made a 20-minute job look like an hour's, and there was no signal about
 * what to do next.
 *
 * ## Where the state lives
 *
 * Deliberately almost nowhere in this component. Each step is its own `<form>`
 * posting to its own Server Action, and the values come back from the vendor
 * record the page loaded. So "preserve what I typed when I navigate away" is
 * satisfied by the data being *saved*, not by being held in memory — which also
 * means it survives a reload, a second device, or coming back tomorrow.
 *
 * The only client state here is which step is open. Completion is derived from
 * the vendor record (`isStepComplete`), never tracked separately, because two
 * sources of truth for "is this done" is how a tick ends up disagreeing with
 * the database.
 *
 * ## What Continue does
 *
 * For the four form steps it submits that step's form via the `form` attribute
 * — the button lives outside the form, which is valid HTML and keeps the
 * existing action, validation and error display exactly as they were. The step
 * calls back on success and only then does the wizard advance. A failed save
 * leaves you on the step with the server's error visible, which is the point.
 *
 * Media and Documents have no single save — they upload as you go — so their
 * Continue checks the requirement is met before moving on.
 */

const SAVE_STEPS: StepKey[] = ['business', 'about', 'categories', 'areas']

export function SinglePageListingForm({
  vendor,
  documents,
  categories,
  cities,
  vendorId,
}: {
  vendor: VendorWorkspace
  documents: VerificationDocument[]
  categories: CategoryRow[]
  cities: CityRow[]
  vendorId: string
}) {
  const complete = useCallback((step: StepKey) => isStepComplete(step, vendor), [vendor])
  const unlocked = useCallback((step: StepKey) => isStepUnlocked(step, vendor), [vendor])

  // Open on the first unfinished step: returning vendors resume where they
  // stopped rather than at a screen they already filled in.
  const [current, setCurrent] = useState<StepKey>(
    () => STEPS.find((s) => !isStepComplete(s.id, vendor))?.id ?? 'business',
  )
  const [blocked, setBlocked] = useState<string | null>(null)

  const index = STEP_INDEX[current]
  const step = STEPS[index]
  const isLast = index === STEPS.length - 1

  const goTo = (next: StepKey) => {
    setBlocked(null)
    setCurrent(next)
    // Bring the form back into view on a phone, where the step rail sits above
    // it and the previous form may have been long.
    document.getElementById('wizard-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const advance = () => {
    const next = STEPS[index + 1]
    if (next) goTo(next.id)
  }

  /** Media and Documents gate on their own requirement rather than a save. */
  const tryAdvanceUploadStep = () => {
    if (current === 'media' && vendor.mediaCount < 3) {
      setBlocked(`Add at least 3 photographs to continue — you have ${vendor.mediaCount}.`)
      return
    }
    if (current === 'documents' && vendor.documentCount < 1) {
      setBlocked('Upload at least one verification document to continue.')
      return
    }
    advance()
  }

  const stepProps = { vendor, readOnly: false, vendorId }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-sand-900 text-2xl sm:text-3xl">Complete your listing</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Nothing is public until you submit for review and our team approves it.
        </p>
      </header>

      <div className="border-sand-200 overflow-hidden rounded-[var(--radius-card)] border bg-white">
        <div className="flex flex-col lg:flex-row">
          {/* Rail: a column on desktop, a scrolling row above the form on mobile. */}
          <div className="border-sand-200 shrink-0 border-b p-4 lg:w-64 lg:border-r lg:border-b-0 lg:p-5">
            <WizardStepper
              current={current}
              onSelect={goTo}
              isComplete={complete}
              isUnlocked={unlocked}
            />
          </div>

          {/* The one open step. */}
          <div id="wizard-panel" className="min-w-0 flex-1 scroll-mt-4 p-4 sm:p-6 lg:p-8">
            <WizardProgress current={current} isComplete={complete} />

            <div
              // Keyed on the step so React remounts it: the fade restarts and no
              // field carries a stale value from the step before.
              key={current}
              className="mt-6 motion-safe:animate-[wizard-step-in_220ms_ease-out]"
            >
              <div className="flex items-start gap-3">
                <span className="bg-brand-50 text-brand-700 flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <step.icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-sand-900 text-xl">{step.headline}</h2>
                  <p className="text-sand-600 mt-0.5 text-sm">{step.description}</p>
                </div>
              </div>

              <div className="mt-6">
                {current === 'business' ? (
                  <WizardBusinessStep {...stepProps} cities={cities} onSaved={advance} />
                ) : current === 'about' ? (
                  <WizardAboutStep {...stepProps} onSaved={advance} />
                ) : current === 'categories' ? (
                  <WizardCategoriesStep {...stepProps} categories={categories} onSaved={advance} />
                ) : current === 'areas' ? (
                  <WizardAreasStep {...stepProps} cities={cities} onSaved={advance} />
                ) : current === 'media' ? (
                  <WizardMediaStep {...stepProps} />
                ) : current === 'documents' ? (
                  <WizardDocumentsStep {...stepProps} documents={documents} />
                ) : (
                  <ReviewStep vendor={vendor} vendorId={vendorId} onEdit={goTo} />
                )}
              </div>

              {blocked ? (
                <p
                  role="alert"
                  className="mt-4 rounded-lg bg-[color-mix(in_oklch,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-[var(--color-danger)]"
                >
                  {blocked}
                </p>
              ) : null}

              {/* Footer navigation. Absent on the last step, where the review
                  screen owns its own submit control. */}
              {!isLast ? (
                <div className="border-sand-200 mt-8 flex items-center justify-between gap-3 border-t pt-5">
                  <button
                    type="button"
                    onClick={() => goTo(STEPS[index - 1].id)}
                    disabled={index === 0}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors',
                      index === 0
                        ? 'text-sand-300 cursor-not-allowed'
                        : 'text-sand-700 hover:bg-sand-100',
                    )}
                  >
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    Back
                  </button>

                  {SAVE_STEPS.includes(current) ? (
                    // Outside the form, submitting it by id. Keeps the step's
                    // own action and validation untouched.
                    <button
                      type="submit"
                      form={`wizard-form-${current}`}
                      className="brand-gradient inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-[var(--shadow-raised)] transition-transform hover:-translate-y-0.5"
                    >
                      Save and continue
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={tryAdvanceUploadStep}
                      className="brand-gradient inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-[var(--shadow-raised)] transition-transform hover:-translate-y-0.5"
                    >
                      Continue
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The final step: what is done, what is missing, and one way back to each.
 *
 * Submitting straight from a button with no summary is how vendors send in
 * half-finished listings and then wait days for a rejection.
 */
function ReviewStep({
  vendor,
  vendorId,
  onEdit,
}: {
  vendor: VendorWorkspace
  vendorId: string
  onEdit: (step: StepKey) => void
}) {
  const reviewable = STEPS.filter((s) => s.id !== 'submit')

  return (
    <div className="space-y-5">
      <ul className="border-sand-200 divide-sand-200 divide-y rounded-[var(--radius-card)] border">
        {reviewable.map((s) => {
          const done = isStepComplete(s.id, vendor)
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full',
                  done ? 'bg-brand-50 text-brand-700' : 'bg-sand-100 text-sand-400',
                )}
              >
                {done ? (
                  <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                ) : (
                  <s.icon aria-hidden="true" className="size-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-sand-900 block text-sm font-medium">{s.label}</span>
                <span className={cn('block text-xs', done ? 'text-sand-500' : 'text-sand-400')}>
                  {done ? 'Completed' : 'Not finished yet'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onEdit(s.id)}
                className="border-sand-300 text-sand-700 hover:bg-sand-100 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium"
              >
                <Pencil aria-hidden="true" className="size-3" />
                Edit<span className="sr-only"> {s.label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <WizardSubmitStep vendor={vendor} vendorId={vendorId} canSubmit />
    </div>
  )
}
