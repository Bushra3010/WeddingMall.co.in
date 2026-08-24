'use client'

import { useCallback } from 'react'

import {
  WizardBusinessStep,
  WizardAboutStep,
  WizardCategoriesStep,
  WizardAreasStep,
  WizardMediaStep,
  WizardDocumentsStep,
  WizardSubmitStep,
} from '@/components/vendor/wizard-steps'
import type { VendorWorkspace, VerificationDocument } from '@/server/dal/vendor-workspace'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

type StepKey = 'business' | 'about' | 'categories' | 'areas' | 'media' | 'documents' | 'submit'

const ALL_STEPS: StepKey[] = [
  'business',
  'about',
  'categories',
  'areas',
  'media',
  'documents',
  'submit',
]

const STEP_LABELS: Record<StepKey, string> = {
  business: 'Business',
  about: 'About',
  categories: 'Categories',
  areas: 'Areas',
  media: 'Media',
  documents: 'Documents',
  submit: 'Submit',
}

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
  const isStepComplete = useCallback(
    (step: StepKey): boolean => {
      const c = vendor.completion
      switch (step) {
        case 'business':
          return Boolean(vendor.displayName?.trim()) && Boolean(vendor.primaryCityId)
        case 'about':
          return (vendor.about?.trim().length ?? 0) >= 50
        case 'categories':
          return c.fields.find((f) => f.key === 'categories')?.done ?? false
        case 'areas':
          return c.fields.find((f) => f.key === 'serviceAreas')?.done ?? false
        case 'media':
          return vendor.mediaCount > 0
        case 'documents':
          return vendor.documentCount > 0
        case 'submit':
          return c.canSubmit
        default:
          return false
      }
    },
    [vendor],
  )

  const completedCount = ALL_STEPS.filter(isStepComplete).length
  const progressPct = Math.round((completedCount / ALL_STEPS.length) * 100)

  const scrollTo = (step: StepKey) => {
    const el = document.getElementById(`step-${step}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Left column: sections */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="font-display text-sand-900 text-2xl sm:text-3xl">
            Complete your listing
          </h1>
          <p className="text-sand-600 mt-1 text-sm">
            Fill in each section below. Nothing is public until you submit for review and our team approves it.
          </p>
        </div>

        {/* Progress bar */}
        <div className="rounded-[var(--radius-card)] border border-sand-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sand-700 text-sm font-medium">
              {progressPct === 100
                ? 'Ready to submit!'
                : `${completedCount} of ${ALL_STEPS.length} sections complete`}
            </p>
            <span className="text-sand-500 text-xs tabular-nums">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-sand-200">
            <div
              className="bg-brand-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {/* Business */}
          <section id="step-business" className="scroll-mt-6">
            <WizardBusinessStep vendor={vendor} cities={cities} readOnly={false} vendorId={vendorId} />
          </section>

          {/* About */}
          <section id="step-about" className="scroll-mt-6">
            <WizardAboutStep vendor={vendor} readOnly={false} vendorId={vendorId} />
          </section>

          {/* Categories */}
          <section id="step-categories" className="scroll-mt-6">
            <WizardCategoriesStep vendor={vendor} categories={categories} readOnly={false} vendorId={vendorId} />
          </section>

          {/* Areas */}
          <section id="step-areas" className="scroll-mt-6">
            <WizardAreasStep vendor={vendor} cities={cities} readOnly={false} vendorId={vendorId} />
          </section>

          {/* Media */}
          <section id="step-media" className="scroll-mt-6">
            <WizardMediaStep vendor={vendor} readOnly={false} vendorId={vendorId} />
          </section>

          {/* Documents */}
          <section id="step-documents" className="scroll-mt-6">
            <WizardDocumentsStep vendor={vendor} documents={documents} readOnly={false} vendorId={vendorId} />
          </section>

          {/* Submit */}
          <section id="step-submit" className="scroll-mt-6">
            <WizardSubmitStep vendor={vendor} vendorId={vendorId} canSubmit={true} />
          </section>
        </div>
      </div>

      {/* Right column: nav + completion */}
      <div className="lg:w-64 shrink-0">
        <div className="lg:sticky lg:top-6 space-y-6">
          {/* Section nav */}
          <nav
            aria-label="Listing sections"
            className="rounded-[var(--radius-card)] border border-sand-200 bg-white p-3"
          >
            <p className="text-sand-700 mb-2 px-1 text-xs font-semibold uppercase tracking-wider">
              Sections
            </p>
            <ul className="space-y-0.5">
              {ALL_STEPS.map((step) => {
                const done = isStepComplete(step)
                return (
                  <li key={step}>
                    <button
                      type="button"
                      onClick={() => scrollTo(step)}
                      className={[
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-left transition-colors',
                        done
                          ? 'text-[var(--color-success)] hover:bg-sand-50'
                          : 'text-sand-700 hover:bg-sand-50',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex size-5 shrink-0 items-center justify-center rounded-full text-xs',
                          done
                            ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                            : 'bg-sand-100 text-sand-500',
                        ].join(' ')}
                      >
                        {done ? (
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-[10px]">{STEP_LABELS[step][0]}</span>
                        )}
                      </span>
                      <span className="truncate">{STEP_LABELS[step]}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  )
}
