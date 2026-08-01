import Image from 'next/image'
import Link from 'next/link'
import { Star } from 'lucide-react'

import { ShortlistNote } from '@/components/customer/shortlist-note'
import { EmptyState } from '@/components/ui/states'
import { buttonVariants } from '@/components/ui/button'
import { NOINDEX } from '@/lib/seo'
import { storagePublicUrl } from '@/lib/supabase/storage'
import { cn } from '@/lib/utils'
import { getShortlist } from '@/server/dal/enquiries'

export const metadata = { title: 'Shortlist', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function ShortlistPage() {
  const shortlist = await getShortlist()

  // Grouped by category, as PRD 6.5 asks for.
  const groups = new Map<string, typeof shortlist>()
  for (const row of shortlist) {
    const key = row.categoryName ?? 'Other'
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Shortlist</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Vendors you have saved. Only you can see this list and your notes.
        </p>
      </header>

      {shortlist.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Tap the heart on any vendor to keep them here while you compare."
          action={{ label: 'Browse vendors', href: '/vendors' }}
        />
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([category, rows]) => (
            <section key={category} aria-labelledby={`group-${category}`}>
              <h2 id={`group-${category}`} className="font-display text-sand-900 text-lg">
                {category}
              </h2>
              <ul className="mt-3 space-y-3">
                {rows.map((row) => {
                  const cover = storagePublicUrl('vendor-media', row.coverPath)
                  return (
                    <li
                      key={row.vendorId}
                      className="border-sand-200 flex gap-4 rounded-[var(--radius-card)] border bg-white p-4"
                    >
                      <div className="bg-sand-100 relative size-20 shrink-0 overflow-hidden rounded-lg">
                        {cover ? (
                          <Image src={cover} alt="" fill sizes="80px" className="object-cover" />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <Link
                            href={`/vendor/${row.vendorSlug}`}
                            className="text-sand-900 font-medium hover:underline"
                          >
                            {row.vendorName}
                          </Link>
                          {row.ratingCount > 0 ? (
                            <span className="text-sand-700 flex items-center gap-1 text-sm">
                              <Star
                                aria-hidden="true"
                                className="fill-accent-500 text-accent-500 size-3.5"
                              />
                              {row.ratingAverage.toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                        {row.cityName ? (
                          <p className="text-sand-600 text-xs">{row.cityName}</p>
                        ) : null}

                        <ShortlistNote vendorId={row.vendorId} note={row.note} />

                        <Link
                          href={`/vendor/${row.vendorSlug}/enquire`}
                          className={cn(buttonVariants({ size: 'sm' }), 'mt-3')}
                        >
                          Request a quote
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
