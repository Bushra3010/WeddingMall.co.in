'use client'

import { useRouter } from 'next/navigation'

import { WizardStep, WizardStepper } from '@/components/vendor/wizard'
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

type Step = 'business' | 'about' | 'categories' | 'areas' | 'media' | 'documents' | 'submit'

const STEPS: WizardStep[] = [
  { slug: 'business', label: 'Business', description: 'Name & contact' },
  { slug: 'about', label: 'About', description: 'Your story' },
  { slug: 'categories', label: 'Categories', description: 'Specialties' },
  { slug: 'areas', label: 'Areas', description: 'Where you work' },
  { slug: 'media', label: 'Media', description: 'Photos & video' },
  { slug: 'documents', label: 'Documents', description: 'Verification' },
  { slug: 'submit', label: 'Submit', description: 'Go live' },
]

export function WizardShell({
  vendor,
  documents,
  categories,
  cities,
  vendorId,
  initialStep,
}: {
  vendor: VendorWorkspace
  documents: VerificationDocument[]
  categories: CategoryRow[]
  cities: CityRow[]
  vendorId: string
  initialStep: string
}) {
  const router = useRouter()

  const currentStep = STEPS.some(s => s.slug === initialStep)
    ? (initialStep as Step)
    : 'business'

  const currentIndex = STEPS.findIndex(s => s.slug === currentStep)
  const nextStep = currentIndex < STEPS.length - 1 ? STEPS[currentIndex + 1].slug : null
  const prevStep = currentIndex > 0 ? STEPS[currentIndex - 1].slug : null

  const navigateTo = (slug: string) => {
    router.push(`/vendor-dashboard/list/${slug}`)
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'business':
        return (
          <WizardBusinessStep
            vendor={vendor}
            cities={cities}
            readOnly={false}
            vendorId={vendorId}
          />
        )
      case 'about':
        return (
          <WizardAboutStep
            vendor={vendor}
            readOnly={false}
            vendorId={vendorId}
          />
        )
      case 'categories':
        return (
          <WizardCategoriesStep
            vendor={vendor}
            categories={categories}
            readOnly={false}
            vendorId={vendorId}
          />
        )
      case 'areas':
        return (
          <WizardAreasStep
            vendor={vendor}
            cities={cities}
            readOnly={false}
            vendorId={vendorId}
          />
        )
      case 'media':
        return (
          <WizardMediaStep
            vendor={vendor}
            readOnly={false}
            vendorId={vendorId}
          />
        )
      case 'documents':
        return (
          <WizardDocumentsStep
            vendor={vendor}
            documents={documents}
            readOnly={false}
            vendorId={vendorId}
          />
        )
      case 'submit':
        return (
          <WizardSubmitStep
            vendor={vendor}
            vendorId={vendorId}
            canSubmit={true}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-display text-sand-900 text-2xl sm:text-3xl">Complete your listing</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Each step takes less than a minute. Skip what you do not need — you can
          always add more later.
        </p>
      </div>

      <WizardStepper steps={STEPS} currentStep={currentStep} />

      <div className="mt-8">
        {renderStep()}
      </div>

      <div className="mt-8 flex items-center justify-between">
        {prevStep ? (
          <button
            onClick={() => navigateTo(prevStep)}
            className="text-sand-600 hover:text-sand-900 inline-flex items-center gap-1 text-sm"
          >
            <span className="hidden sm:inline">&larr; Back</span>
            <span className="sm:hidden">&larr;</span>
          </button>
        ) : (
          <div />
        )}

        {nextStep && currentStep !== 'submit' ? (
          <button
            onClick={() => navigateTo(nextStep)}
            className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Next <span className="hidden sm:inline">&rarr;</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
