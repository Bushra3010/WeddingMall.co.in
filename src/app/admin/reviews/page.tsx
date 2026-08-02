import Link from 'next/link'
import { Star } from 'lucide-react'

import { ModerationActions } from '@/components/reviews/moderation-actions'
import { EmptyState } from '@/components/ui/states'
import { formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { requireElevatedAdmin } from '@/server/policies/require'
import { getReviewModerationQueue, getReviewQueueCounts } from '@/server/dal/reviews'

export const metadata = { title: 'Review moderation', ...NOINDEX }
export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
] as const

type QueueStatus = (typeof TABS)[number]['key']

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireElevatedAdmin('review.moderate')

  const params = await searchParams
  const status: QueueStatus = TABS.some((tab) => tab.key === params.status)
    ? (params.status as QueueStatus)
    : 'pending'

  const [queue, counts] = await Promise.all([
    getReviewModerationQueue(status),
    getReviewQueueCounts(),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Review moderation</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Ratings update only once a review is approved. An author editing an approved review sends
          it back to this queue, so the published text is always one a moderator has seen.
        </p>
      </header>

      <nav aria-label="Queue" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/reviews?status=${tab.key}`}
            aria-current={tab.key === status ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              tab.key === status
                ? 'bg-brand-700 text-white'
                : 'border-sand-300 text-sand-700 hover:bg-sand-100 border',
            )}
          >
            {tab.label}
            {counts[tab.key] ? <span className="ml-1.5 opacity-70">{counts[tab.key]}</span> : null}
          </Link>
        ))}
      </nav>

      {queue.length === 0 ? (
        <EmptyState title="Nothing here" description={`No reviews are currently ${status}.`} />
      ) : (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-[var(--radius-card)] border bg-white">
          {queue.map((review) => (
            <li key={review.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sand-900 font-medium">{review.vendorName}</p>
                <span className="text-sand-500 text-xs">
                  {formatRelative(review.createdAt)}
                  {review.editedAt ? ' · edited' : ''}
                  {review.revisionCount > 0
                    ? ` · ${review.revisionCount} previous version${
                        review.revisionCount === 1 ? '' : 's'
                      }`
                    : ''}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-0.5"
                  aria-label={`${review.overallRating} out of 5`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      aria-hidden="true"
                      className={cn(
                        'size-3.5',
                        star <= review.overallRating
                          ? 'fill-gold-500 text-gold-500'
                          : 'text-sand-300',
                      )}
                    />
                  ))}
                </span>
                <span className="text-sand-500 text-xs">
                  by {review.customerName ?? 'a customer'}
                </span>
              </div>

              {review.title ? (
                <p className="text-sand-900 mt-2 text-sm font-medium">{review.title}</p>
              ) : null}
              <p className="text-sand-700 mt-1 text-sm whitespace-pre-line">{review.body}</p>

              <ModerationActions reviewId={review.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
