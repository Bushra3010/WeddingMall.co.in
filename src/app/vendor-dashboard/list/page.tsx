import { redirect } from 'next/navigation'

import { WizardShell } from '@/components/vendor/wizard-shell'
import {
  getMyVendors,
  getVendorWorkspace,
  getVerificationDocuments,
} from '@/server/dal/vendor-workspace'
import { listCategories, listCities } from '@/server/dal/taxonomy'
import { createVendorForUser } from '@/server/services/vendor-onboarding'
import { getActor } from '@/server/dal/actor'

import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({ title: 'Complete your listing', noindex: true })
export const dynamic = 'force-dynamic'

export default async function ListingWizardPage() {
  const actor = await getActor()
  if (!actor.userId) redirect('/auth/sign-in?next=/vendor-dashboard/list')

  const mine = await getMyVendors()

  /*
   * A brand-new vendor has no rows yet, so one is created on first visit.
   *
   * The id comes from the create call rather than a second `getMyVendors()`.
   * That re-query looks like the obvious thing to do and is exactly what broke
   * signup: `getMyVendors` is wrapped in React `cache()`, which memoises per
   * request, so the second call returned the same empty array captured *before*
   * the vendor existed. Creation succeeded every time — every vendor in the
   * database has its membership and listing — and the page still redirected to
   * /vendor/join, so a new vendor bounced straight back out of the wizard they
   * had just signed up for.
   */
  const vendorId = mine.length > 0 ? mine[0].vendor.id : await createVendorForUser(actor)

  if (!vendorId) redirect('/vendor/join')
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
