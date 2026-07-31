import { redirect } from 'next/navigation'

import { PackageManager } from '@/components/vendor/package-manager'
import { PermissionDenied } from '@/components/ui/states'
import { canVendor } from '@/lib/permissions'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { getVendorPackages } from '@/server/dal/listings'
import { getMyVendors } from '@/server/dal/vendor-workspace'
import { listCategories } from '@/server/dal/taxonomy'

export const metadata = { title: 'Packages', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function PackagesPage() {
  const actor = await getActor()
  const mine = await getMyVendors()
  if (mine.length === 0) redirect('/vendor/join')

  const vendorId = mine[0].vendor.id
  if (!canVendor(actor, vendorId, 'analytics.view')) return <PermissionDenied />

  const [packages, categories] = await Promise.all([
    getVendorPackages(vendorId),
    listCategories(40),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Packages</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Prices appear on your public profile and power the budget filter couples search with.
        </p>
      </header>

      <PackageManager
        vendorId={vendorId}
        packages={packages}
        categories={categories}
        readOnly={!canVendor(actor, vendorId, 'package.manage')}
      />
    </div>
  )
}
