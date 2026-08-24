import { redirect } from 'next/navigation'

import { WizardShell } from '@/components/vendor/wizard-shell'
import { getMyVendors, getVendorWorkspace, getVerificationDocuments } from '@/server/dal/vendor-workspace'
import { listCategories, listCities } from '@/server/dal/taxonomy'
import { createVendorForUser } from '@/server/services/vendor-onboarding'
import { getActor } from '@/server/dal/actor'

import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({ title: 'Complete your listing', noindex: true })
export const dynamic = 'force-dynamic'

export default async function ListingWizardPage() {
  const actor = await getActor()
  if (!actor.userId) redirect('/auth/sign-in?next=/vendor-dashboard/list')

  let mine = await getMyVendors()

  if (mine.length === 0) {
    const slug = await createVendorForUser(actor)
    if (slug) {
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

  return (
    <WizardShell
      vendor={vendor}
      documents={documents}
      categories={categories}
      cities={cities}
      vendorId={vendorId}
    />
  )
}
