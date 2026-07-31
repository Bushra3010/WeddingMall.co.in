import { redirect } from 'next/navigation'

import { PortfolioManager } from '@/components/vendor/portfolio-manager'
import { PermissionDenied } from '@/components/ui/states'
import { canVendor } from '@/lib/permissions'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { getVendorMedia } from '@/server/dal/listings'
import { getMyVendors } from '@/server/dal/vendor-workspace'

export const metadata = { title: 'Portfolio', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const actor = await getActor()
  const mine = await getMyVendors()
  if (mine.length === 0) redirect('/vendor/join')

  const vendorId = mine[0].vendor.id
  if (!canVendor(actor, vendorId, 'analytics.view')) return <PermissionDenied />

  const media = await getVendorMedia(vendorId)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Portfolio</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Upload your work, choose a cover image, and describe each photo.
        </p>
      </header>

      <PortfolioManager
        vendorId={vendorId}
        media={media}
        readOnly={!canVendor(actor, vendorId, 'media.manage')}
      />
    </div>
  )
}
