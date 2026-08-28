import Link from 'next/link'

import { VendorRowActions } from '@/components/admin/vendor-row-actions'
import { EmptyState } from '@/components/ui/states'
import { NOINDEX } from '@/lib/seo'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/dates'
import { requireElevatedAdmin } from '@/server/policies/require'
import { getReviewQueue, type VendorStatus } from '@/server/dal/admin'

export const metadata = { title: 'Vendors', ...NOINDEX }
export const dynamic = 'force-dynamic'

const TABS: { status: VendorStatus; label: string }[] = [
  { status: 'pending_review', label: 'Awaiting review' },
  { status: 'active', label: 'Live' },
  { status: 'draft', label: 'Draft' },
  { status: 'suspended', label: 'Suspended' },
  { status: 'rejected', label: 'Rejected' },
]

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const actor = await requireElevatedAdmin('vendor.read')
  const { status } = await searchParams
  // Narrow the query-string value against the known tabs rather than casting:
  // an unknown status must fall back, not reach the database.
  //
  // The fallback used to be `active`, which is the one tab a new business can
  // never be in. Registration now opens at `pending_review` (migration 0035),
  // so the page an admin lands on is the queue that needs them.
  const active: VendorStatus = TABS.find((tab) => tab.status === status)?.status ?? 'pending_review'
  const rows = await getReviewQueue(active)

  const canVerify = can(actor, 'vendor.verify')
  // Removing a business outright is super-admin only; a verifier suspends.
  const canDelete = can(actor, 'admin.manage')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Vendors</h1>
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/admin/vendors?status=${tab.status}`}
            aria-current={tab.status === active ? 'page' : undefined}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs',
              tab.status === active
                ? 'bg-brand-700 text-white'
                : 'border-sand-300 text-sand-700 hover:border-brand-300 border bg-white',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title="No businesses with this status" />
      ) : (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-[var(--radius-card)] border bg-white">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/vendors/${row.id}`}
                  className="text-brand-700 font-medium hover:underline"
                >
                  {row.displayName}
                </Link>
                <p className="text-sand-600 text-xs">
                  {[row.categoryName, row.cityName].filter(Boolean).join(' · ') || '—'}
                </p>
                <p className="text-sand-500 mt-0.5 text-xs">
                  {row.verificationStatus}
                  {row.submittedAt ? ` · applied ${formatRelative(row.submittedAt)}` : ''}
                  {row.documentCount > 0
                    ? ` · ${row.documentCount} document${row.documentCount === 1 ? '' : 's'}`
                    : ''}
                </p>
                {/*
                  A business can now reach the queue before it has written
                  anything. Approving one of those publishes a blank profile, so
                  what is missing is stated on the row rather than discovered
                  after the fact.
                */}
                {row.missing.length > 0 ? (
                  <p className="bg-accent-100 text-accent-700 mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs">
                    Listing incomplete — no {row.missing.join(', no ')}
                  </p>
                ) : null}
              </div>

              <VendorRowActions
                vendorId={row.id}
                displayName={row.displayName}
                status={row.status}
                canVerify={canVerify}
                canDelete={canDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
