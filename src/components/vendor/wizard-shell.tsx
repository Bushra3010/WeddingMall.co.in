'use client'

import { SinglePageListingForm } from '@/components/vendor/listing-form'
import type { VendorWorkspace, VerificationDocument } from '@/server/dal/vendor-workspace'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

/**
 * Listing page shell.
 *
 * Replaces the old step-by-step wizard (Booking.com style):
 * all sections render on one scrollable page with a progress bar
 * and a quick-jump sidebar on desktop.
 */
export function WizardShell({
  vendor,
  documents,
  categories,
  cities,
  vendorId,
}: {
  vendor: VendorWorkspace
  documents: VerificationDocument[]
  categories: CategoryRow[]
  cities: CityRow[]
  vendorId: string
}) {
  return (
    <SinglePageListingForm
      vendor={vendor}
      documents={documents}
      categories={categories}
      cities={cities}
      vendorId={vendorId}
    />
  )
}
