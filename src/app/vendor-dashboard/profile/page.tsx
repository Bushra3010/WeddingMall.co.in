import { redirect } from 'next/navigation'

import { BusinessDetailsForm } from '@/components/vendor/onboarding-forms'
import { StatusBanner } from '@/components/vendor/status-banner'
import { PermissionDenied } from '@/components/ui/states'
import { canVendor } from '@/lib/permissions'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { getMyVendors, getVendorWorkspace } from '@/server/dal/vendor-workspace'
import { listCities } from '@/server/dal/taxonomy'

export const metadata = { title: 'Business profile', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function VendorProfilePage() {
  const actor = await getActor()
  const mine = await getMyVendors()
  if (mine.length === 0) redirect('/vendor/join')

  const [vendor, cities] = await Promise.all([
    getVendorWorkspace(mine[0].vendor.id),
    listCities(60),
  ])
  if (!vendor) return <PermissionDenied />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Business profile</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Contact details stay private. Only your business name and city appear publicly.
        </p>
      </header>

      <StatusBanner vendor={vendor} />

      <BusinessDetailsForm
        vendor={vendor}
        cities={cities}
        readOnly={!canVendor(actor, vendor.id, 'listing.edit')}
      />
    </div>
  )
}
