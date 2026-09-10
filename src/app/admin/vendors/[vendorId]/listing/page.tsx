import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { WizardShell } from '@/components/vendor/wizard-shell'
import { PermissionDenied } from '@/components/ui/states'
import { NOINDEX } from '@/lib/seo'
import { can } from '@/lib/permissions'
import { requireElevatedAdmin } from '@/server/policies/require'
import { getVendorWorkspace, getVerificationDocuments } from '@/server/dal/vendor-workspace'
import { listCategories, listCities } from '@/server/dal/taxonomy'

export const metadata = { title: 'Edit listing', ...NOINDEX }
export const dynamic = 'force-dynamic'

/**
 * The vendor's own listing editor, for an admin, on any business (0041).
 *
 * This is deliberately the **same component** the vendor sees at
 * `/vendor-dashboard/listing` rather than an admin-shaped imitation of it.
 * `/admin/vendors/<id>` could edit a business's name, city and description and
 * nothing else — no photographs, which is the first thing couples look at, and
 * no categories, service areas or packages either. A business signed up over
 * the phone could be created (0039) and never finished.
 *
 * A second editor would have been a second set of validation rules, a second
 * completion meter, and two places for "what a listing needs" to drift apart.
 * Every action the wizard fires already re-checks permission server-side, and
 * `assertListingCapability` is what admits an admin — so the component needed no
 * admin branch at all.
 *
 * Two things are not the same as the vendor's view:
 *  - **Submit is off.** Submitting sends the listing to the queue this admin
 *    works. They publish from the Decision panel, which records it under their
 *    own name; a submission would be recorded as the vendor's.
 *  - **Payout details are not here.** They are on the business page behind
 *    `billing.manage`, which is a different desk from the one that edits
 *    listings, and the account number is never rendered into a page (0038).
 */
export default async function AdminVendorListingPage({
  params,
}: {
  params: Promise<{ vendorId: string }>
}) {
  const actor = await requireElevatedAdmin('vendor.read')
  const { vendorId } = await params

  // Mirrors the eight policies in 0041. Checked here as well so an admin who
  // cannot edit gets a sentence rather than a page of controls that each refuse
  // on submit.
  if (!can(actor, 'listing.moderate')) {
    return <PermissionDenied />
  }

  const [vendor, documents, categories, cities] = await Promise.all([
    getVendorWorkspace(vendorId),
    getVerificationDocuments(vendorId),
    // Wider than the vendor's own 40/60 for the reason the edit form gives: an
    // admin correcting a business must be able to reach any category or city,
    // not only the ones the homepage happens to show.
    listCategories(200),
    listCities(200),
  ])

  if (!vendor) notFound()

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sand-500 text-xs">
        <Link href="/admin/vendors" className="hover:text-brand-700">
          Vendors
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/admin/vendors/${vendorId}`} className="hover:text-brand-700">
          {vendor.displayName}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-sand-700">Listing</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-sand-900 text-2xl">Edit listing</h1>
          <p className="text-sand-600 mt-1 max-w-prose text-sm">
            Everything the business would fill in itself — photographs, categories, service areas,
            packages and availability. Changes are saved against{' '}
            <span className="text-sand-900 font-medium">{vendor.displayName}</span> as if the
            business had made them.
          </p>
        </div>
        <Link
          href={`/admin/vendors/${vendorId}`}
          className="text-brand-700 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to the business
        </Link>
      </header>

      <WizardShell
        vendor={vendor}
        documents={documents}
        categories={categories}
        cities={cities}
        vendorId={vendorId}
        // `billing.manage`, not `listing.moderate` — a different desk. The
        // business page owns payout details and audits every change to them.
        canManageBank={false}
        canSubmit={false}
        showHeader={false}
      />
    </div>
  )
}
