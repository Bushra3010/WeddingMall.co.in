import { redirect } from 'next/navigation'

import { AvailabilityManager } from '@/components/vendor/availability-manager'
import { PermissionDenied } from '@/components/ui/states'
import { canVendor } from '@/lib/permissions'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { getVendorAvailability } from '@/server/dal/listings'
import { getMyVendors } from '@/server/dal/vendor-workspace'

export const metadata = { title: 'Availability', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function AvailabilityPage() {
  const actor = await getActor()
  const mine = await getMyVendors()
  if (mine.length === 0) redirect('/vendor/join')

  const vendorId = mine[0].vendor.id
  if (!canVendor(actor, vendorId, 'analytics.view')) return <PermissionDenied />

  const entries = await getVendorAvailability(vendorId)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Availability</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Couples see a general signal only — never your private notes, and never a guarantee you
          have not confirmed.
        </p>
      </header>

      <AvailabilityManager
        vendorId={vendorId}
        entries={entries}
        readOnly={!canVendor(actor, vendorId, 'availability.manage')}
      />
    </div>
  )
}
