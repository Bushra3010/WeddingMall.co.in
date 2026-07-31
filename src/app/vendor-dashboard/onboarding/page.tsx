import { redirect } from 'next/navigation'

import { CompletionMeter } from '@/components/vendor/completion-meter'
import { StatusBanner } from '@/components/vendor/status-banner'
import {
  BusinessDetailsForm,
  CategoriesForm,
  DocumentsSection,
  ListingForm,
  ServiceAreasForm,
  SubmitForReviewCard,
} from '@/components/vendor/onboarding-forms'
import { PermissionDenied } from '@/components/ui/states'
import { NOINDEX } from '@/lib/seo'
import { canVendor } from '@/lib/permissions'
import { getActor } from '@/server/dal/actor'
import { listCategories, listCities } from '@/server/dal/taxonomy'
import {
  getMyVendors,
  getVendorWorkspace,
  getVerificationDocuments,
} from '@/server/dal/vendor-workspace'

export const metadata = { title: 'Onboarding', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const actor = await getActor()
  const mine = await getMyVendors()

  if (mine.length === 0) redirect('/vendor/join')

  const vendorId = mine[0].vendor.id
  const [vendor, documents, categories, cities] = await Promise.all([
    getVendorWorkspace(vendorId),
    getVerificationDocuments(vendorId),
    listCategories(40),
    listCities(60),
  ])

  if (!vendor) return <PermissionDenied />

  // A viewer or sales member can see progress but must not edit the listing.
  const canEdit = canVendor(actor, vendorId, 'listing.edit')
  const canSubmit = canVendor(actor, vendorId, 'listing.submit')
  const canManageDocuments = canVendor(actor, vendorId, 'team.manage')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Set up your business</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Nothing here is public until you submit for review and our team approves it.
        </p>
      </header>

      <StatusBanner vendor={vendor} />

      {!canEdit ? (
        <p className="border-sand-300 bg-sand-50 text-sand-700 rounded-lg border p-3 text-sm">
          Your role gives you read-only access to these details.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <BusinessDetailsForm vendor={vendor} cities={cities} readOnly={!canEdit} />
          <CategoriesForm vendor={vendor} categories={categories} readOnly={!canEdit} />
          <ServiceAreasForm vendor={vendor} cities={cities} readOnly={!canEdit} />
          <ListingForm vendor={vendor} readOnly={!canEdit} />
          <DocumentsSection vendor={vendor} documents={documents} readOnly={!canManageDocuments} />
          {canSubmit && vendor.status !== 'pending_review' ? (
            <SubmitForReviewCard vendor={vendor} />
          ) : null}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <CompletionMeter completion={vendor.completion} />
        </div>
      </div>
    </div>
  )
}
