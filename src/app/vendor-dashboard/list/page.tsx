import { redirect } from 'next/navigation'

import { WizardShell } from '@/components/vendor/wizard-shell'
import { getMyVendors, getVendorWorkspace, getVerificationDocuments } from '@/server/dal/vendor-workspace'
import { listCategories, listCities } from '@/server/dal/taxonomy'
import { createVendorForUser } from '@/server/services/vendor-onboarding'
import { getActor } from '@/server/dal/actor'

import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({ title: 'Complete your listing', noindex: true })
export const dynamic = 'force-dynamic'

type WizardPageProps = {
  params: Promise<{ step?: string[] }>
}

export default async function ListingWizardPage({ params }: WizardPageProps) {
  const actor = await getActor()
  if (!actor.userId) redirect('/auth/sign-in?next=/vendor-dashboard/list')

  let mine = await getMyVendors()

  // Auto-create vendor if this is their first time in the wizard
  if (mine.length === 0) {
    const slug = await createVendorForUser(actor)
    if (slug) {
      // Refresh the list after creation
      mine = await getMyVendors()
    }
  }

  if (mine.length === 0) redirect('/vendor/join')

  const vendorId = mine[0].vendor.id
  const [vendor, documents, categories, cities] = await Promise.all([
    getVendorWorkspace(vendorId),
    getVerificationDocuments(vendorId),
    listCategories(40),
    listCities(60),
  ])

  if (!vendor) redirect('/vendor/join')

  const { step } = await params
  const stepSlug = step?.[0] ?? 'business'

  return (
    <WizardShell
      vendor={vendor}
      documents={documents}
      categories={categories}
      cities={cities}
      vendorId={vendorId}
      initialStep={stepSlug}
    />
  )
}
