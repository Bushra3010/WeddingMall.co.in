import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ListingDecisionForm } from '@/components/admin/listing-decision-form'
import { NOINDEX } from '@/lib/seo'
import { formatDateTime } from '@/lib/dates'
import { requireElevatedAdmin } from '@/server/policies/require'
import { getVersionComparison } from '@/server/dal/listings'

export const metadata = { title: 'Review listing', ...NOINDEX }
export const dynamic = 'force-dynamic'

function text(snapshot: Record<string, unknown> | null, key: string): string {
  const value = snapshot?.[key]
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  return String(value)
}

/**
 * Side-by-side review. A moderator needs to see what is *changing*, not
 * re-read the whole listing — so the currently published snapshot sits next to
 * the proposed one, with changed fields marked.
 */
export default async function ReviewListingPage({
  params,
}: {
  params: Promise<{ versionId: string }>
}) {
  await requireElevatedAdmin('listing.moderate')
  const { versionId } = await params
  const comparison = await getVersionComparison(versionId)
  if (!comparison) notFound()

  const fields: { key: string; label: string }[] = [
    { key: 'about', label: 'About' },
    { key: 'experience_years', label: 'Years in business' },
    { key: 'languages', label: 'Languages' },
  ]

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sand-500 text-xs">
        <Link href="/admin/listings" className="hover:text-brand-700">
          Listing moderation
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-sand-700">{comparison.vendorName}</span>
      </nav>

      <header>
        <h1 className="font-display text-sand-900 text-2xl">{comparison.vendorName}</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Version {comparison.versionNo} submitted {formatDateTime(comparison.createdAt)}
          {comparison.publishedVersionNo
            ? ` · version ${comparison.publishedVersionNo} is currently published`
            : ' · nothing published yet'}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {fields.map((field) => {
            const before = text(comparison.published, field.key)
            const after = text(comparison.pending, field.key)
            const changed = before !== after

            return (
              <section
                key={field.key}
                className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sand-900 font-medium">{field.label}</h2>
                  {changed ? (
                    <span className="bg-accent-100 text-accent-700 rounded-full px-2 py-0.5 text-xs font-medium">
                      Changed
                    </span>
                  ) : (
                    <span className="text-sand-400 text-xs">Unchanged</span>
                  )}
                </div>

                {changed && comparison.published ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-sand-500 text-xs tracking-wide uppercase">
                        Currently published
                      </p>
                      <p className="text-sand-600 mt-1 text-sm whitespace-pre-line">{before}</p>
                    </div>
                    <div>
                      <p className="text-sand-500 text-xs tracking-wide uppercase">Proposed</p>
                      <p className="text-sand-900 mt-1 text-sm whitespace-pre-line">{after}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sand-900 mt-2 text-sm whitespace-pre-line">{after}</p>
                )}
              </section>
            )
          })}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <ListingDecisionForm
            versionId={comparison.versionId}
            isFirstPublication={comparison.publishedVersionNo === null}
          />
        </div>
      </div>
    </div>
  )
}
