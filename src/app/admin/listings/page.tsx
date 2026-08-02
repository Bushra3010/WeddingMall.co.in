import Link from 'next/link'

import { EmptyState } from '@/components/ui/states'
import { formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { requireElevatedAdmin } from '@/server/policies/require'
import { getListingReviewQueue } from '@/server/dal/listings'

export const metadata = { title: 'Listing moderation', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function AdminListingsPage() {
  await requireElevatedAdmin('listing.moderate')
  const queue = await getListingReviewQueue()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Listing moderation</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Edits awaiting review. The version currently published stays live until you approve the
          replacement.
        </p>
      </header>

      {queue.length === 0 ? (
        <EmptyState title="Nothing waiting" description="Submitted listing edits appear here." />
      ) : (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-[var(--radius-card)] border bg-white">
          {queue.map((row) => (
            <li key={row.versionId} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/admin/listings/${row.versionId}`}
                  className="text-brand-700 font-medium hover:underline"
                >
                  {row.vendorName}
                </Link>
                <span className="text-sand-500 text-xs">
                  {row.isFirstPublication ? 'First publication' : `Version ${row.versionNo}`} ·{' '}
                  {formatRelative(row.createdAt)}
                </span>
              </div>
              {row.about ? (
                <p className="text-sand-600 mt-1 line-clamp-2 text-sm">{row.about}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
