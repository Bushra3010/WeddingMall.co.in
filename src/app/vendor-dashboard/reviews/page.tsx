import { Star } from 'lucide-react'

import { ReviewResponseForm } from '@/components/reviews/review-response-form'
import { EmptyState } from '@/components/ui/states'
import { formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { requireOwnVendorId } from '@/server/policies/require'
import { getVendorReviewInbox } from '@/server/dal/reviews'

export const metadata = { title: 'Reviews', ...NOINDEX }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  pending: 'In moderation',
  approved: 'Published',
  rejected: 'Not published',
  flagged: 'Under review',
}

export default async function VendorReviewsPage() {
  const vendorId = await requireOwnVendorId()
  const reviews = await getVendorReviewInbox(vendorId)

  const published = reviews.filter((review) => review.status === 'approved')
  const average =
    published.length > 0
      ? published.reduce((sum, review) => sum + review.overallRating, 0) / published.length
      : 0

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Reviews</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          You can reply once to each published review. Replies are moderated before they appear.
          {/*
            Reviews in moderation are shown here deliberately: a vendor finding
            out about a complaint only when it goes live has no chance to
            prepare a reply.
          */}
        </p>
      </header>

      {published.length > 0 ? (
        <p className="text-sand-700 text-sm">
          <span className="font-display text-sand-900 text-xl">{average.toFixed(1)}</span> average
          from {published.length} published review{published.length === 1 ? '' : 's'}.
        </p>
      ) : null}

      {reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Couples can review you once an enquiry with them has progressed."
        />
      ) : (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-[var(--radius-card)] border bg-white">
          {reviews.map((review) => (
            <li key={review.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-0.5"
                  aria-label={`${review.overallRating} out of 5`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      aria-hidden="true"
                      className={cn(
                        'size-4',
                        star <= review.overallRating
                          ? 'fill-gold-500 text-gold-500'
                          : 'text-sand-300',
                      )}
                    />
                  ))}
                </span>
                <span className="text-sand-500 text-xs">
                  {STATUS_LABEL[review.status] ?? review.status} ·{' '}
                  {formatRelative(review.createdAt)}
                </span>
              </div>

              <p className="text-sand-500 mt-1 text-xs">by {review.customerName ?? 'a customer'}</p>

              {review.title ? (
                <p className="text-sand-900 mt-2 text-sm font-medium">{review.title}</p>
              ) : null}
              <p className="text-sand-700 mt-1 text-sm whitespace-pre-line">{review.body}</p>

              {review.status === 'approved' ? (
                <ReviewResponseForm reviewId={review.id} existing={review.response} />
              ) : (
                <p className="text-sand-500 mt-3 text-xs">
                  You can reply once this review is published.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
