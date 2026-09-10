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
  canManageBank,
  showHeader = true,
  canSubmit = true,
}: {
  vendor: VendorWorkspace
  documents: VerificationDocument[]
  categories: CategoryRow[]
  cities: CityRow[]
  vendorId: string
  /** `billing.manage` — the owner alone. Decided on the server. */
  canManageBank: boolean
  /** False from `/vendor-dashboard/listing`, which has its own heading. */
  showHeader?: boolean
  /**
   * False for an admin editing somebody else's listing. Submitting sends it to
   * the queue they themselves work; they publish from the decision panel, which
   * records the decision under their own name.
   */
  canSubmit?: boolean
}) {
  return (
    <SinglePageListingForm
      vendor={vendor}
      documents={documents}
      categories={categories}
      cities={cities}
      vendorId={vendorId}
      canManageBank={canManageBank}
      showHeader={showHeader}
      canSubmit={canSubmit}
    />
  )
}
