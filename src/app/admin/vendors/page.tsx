import Link from 'next/link'

import { EmptyState } from '@/components/ui/states'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { requireAdmin } from '@/server/policies/require'
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
  await requireAdmin('vendor.read')
  const { status } = await searchParams
  // Narrow the query-string value against the known tabs rather than casting:
  // an unknown status must fall back, not reach the database.
  const active: VendorStatus = TABS.find((tab) => tab.status === status)?.status ?? 'active'
  const rows = await getReviewQueue(active)

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
            <li key={row.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <Link
                  href={`/admin/vendors/${row.id}`}
                  className="text-brand-700 font-medium hover:underline"
                >
                  {row.displayName}
                </Link>
                <p className="text-sand-600 text-xs">
                  {[row.categoryName, row.cityName].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <span className="text-sand-500 text-xs">{row.verificationStatus}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
