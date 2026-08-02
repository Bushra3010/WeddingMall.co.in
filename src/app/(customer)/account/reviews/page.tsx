import Link from 'next/link'
import { Star } from 'lucide-react'

import { ReviewEditForm, ReviewForm } from '@/components/reviews/review-form'
import { EmptyState } from '@/components/ui/states'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { getOwnReviews, getReviewableEnquiries } from '@/server/dal/reviews'

export const metadata = { title: 'Your reviews', ...NOINDEX }
export const dynamic = 'force-dynamic'

/** Moderation state in the customer's language, not the database's. */
const STATUS_COPY: Record<string, { label: string; tone: string; note?: string }> = {
  pending: {
    label: 'In moderation',
    tone: 'bg-[color-mix(in_oklch,var(--color-warning)_20%,white)] text-sand-800',
    note: 'Not visible on the vendor profile yet.',
  },
  approved: {
    label: 'Published',
    tone: 'bg-[color-mix(in_oklch,var(--color-success)_16%,white)] text-[var(--color-success)]',
  },
  rejected: {
    label: 'Not published',
    tone: 'bg-[color-mix(in_oklch,var(--color-danger)_12%,white)] text-[var(--color-danger)]',
  },
  flagged: {
    label: 'Under review',
    tone: 'bg-[color-mix(in_oklch,var(--color-warning)_20%,white)] text-sand-800',
  },
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn('size-4', star <= value ? 'fill-gold-500 text-gold-500' : 'text-sand-300')}
        />
      ))}
    </span>
  )
}

export default async function CustomerReviewsPage() {
  const [reviewable, own] = await Promise.all([getReviewableEnquiries(), getOwnReviews()])

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Your reviews</h1>
        <p className="text-sand-600 mt-1 text-sm">
          You can review a vendor once your enquiry with them has progressed. Every review is
          moderated before it appears.
        </p>
      </header>

      <section aria-labelledby="reviews-to-write">
        <h2 id="reviews-to-write" className="font-display text-sand-900 text-lg">
          Waiting for your review
        </h2>

        {reviewable.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Nothing to review yet"
              description="Once a vendor has responded to one of your enquiries, you will be able to review them here."
              action={{ label: 'Your enquiries', href: '/account/enquiries' }}
            />
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {reviewable.map((item) => (
              <li
                key={item.enquiryId}
                className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sand-900 font-medium">
                    <Link href={`/vendor/${item.vendorSlug}`} className="hover:underline">
                      {item.vendorName}
                    </Link>
                  </h3>
                  {item.eventDate ? (
                    <p className="text-sand-500 text-xs">Event {item.eventDate}</p>
                  ) : null}
                </div>
                <div className="mt-4">
                  <ReviewForm enquiryId={item.enquiryId} vendorName={item.vendorName} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reviews-written">
        <h2 id="reviews-written" className="font-display text-sand-900 text-lg">
          Reviews you have written
        </h2>

        {own.length === 0 ? (
          <p className="text-sand-600 mt-3 text-sm">You have not written any reviews yet.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {own.map((review) => {
              const status = STATUS_COPY[review.status] ?? {
                label: review.status,
                tone: 'bg-sand-100 text-sand-700',
              }
              return (
                <li
                  key={review.id}
                  className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sand-900 font-medium">
                      <Link href={`/vendor/${review.vendorSlug}`} className="hover:underline">
                        {review.vendorName}
                      </Link>
                    </h3>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        status.tone,
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <Stars value={review.overallRating} />
                    {review.revisionCount > 0 ? (
                      <span className="text-sand-500 text-xs">
                        Edited{' '}
                        {review.revisionCount === 1 ? 'once' : `${review.revisionCount} times`}
                      </span>
                    ) : null}
                  </div>

                  {status.note ? <p className="text-sand-500 mt-1 text-xs">{status.note}</p> : null}

                  {/*
                    The rejection reason is shown to the author. Withholding it
                    leaves someone unable to tell whether the problem was their
                    wording or something they cannot fix.
                  */}
                  {review.moderationReason ? (
                    <p className="text-sand-600 border-sand-100 mt-2 border-l-2 pl-3 text-sm">
                      Moderator note: {review.moderationReason}
                    </p>
                  ) : null}

                  <details className="mt-3">
                    <summary className="text-brand-700 cursor-pointer text-sm font-medium">
                      Edit this review
                    </summary>
                    <div className="mt-3">
                      <ReviewEditForm
                        reviewId={review.id}
                        vendorSlug={review.vendorSlug}
                        defaults={{
                          overallRating: review.overallRating,
                          title: review.title,
                          body: review.body,
                          eventDate: review.eventDate,
                        }}
                      />
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
