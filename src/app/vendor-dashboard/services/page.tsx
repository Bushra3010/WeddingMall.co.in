import { redirect } from 'next/navigation'

import { AttributeForm } from '@/components/vendor/attribute-form'
import { PermissionDenied } from '@/components/ui/states'
import { canVendor } from '@/lib/permissions'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { listAttributes } from '@/server/dal/taxonomy'
import { getVendorAttributeValues } from '@/server/dal/vendor-attributes'
import { getMyVendors, getVendorWorkspace } from '@/server/dal/vendor-workspace'

export const metadata = { title: 'Services', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const actor = await getActor()
  const mine = await getMyVendors()
  if (mine.length === 0) redirect('/vendor/join')

  const vendorId = mine[0].vendor.id
  const [vendor, allAttributes, values] = await Promise.all([
    getVendorWorkspace(vendorId),
    listAttributes(),
    getVendorAttributeValues(vendorId),
  ])
  if (!vendor) return <PermissionDenied />

  // Only ask about the categories this vendor actually belongs to.
  const attributes = allAttributes.filter((a) => vendor.categoryIds.includes(a.categoryId))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Services</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          These answers power the filters couples use to narrow their search. The more you answer,
          the more searches you appear in.
        </p>
      </header>

      <AttributeForm
        vendorId={vendorId}
        attributes={attributes}
        values={values}
        readOnly={!canVendor(actor, vendorId, 'listing.edit')}
      />
    </div>
  )
}
