import { Suspense } from 'react'

import { SearchResults } from '@/components/public/search-results'
import { CardSkeleton } from '@/components/ui/states'
import { parseSearchParams } from '@/features/search/filters'
import { buildMetadata } from '@/lib/seo'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * Open-ended search. Deliberately noindex: arbitrary filter combinations create
 * thin, near-duplicate pages (PRD 11.1). The indexable routes are
 * /vendors/[category] and /vendors/[category]/[city].
 */
export const metadata = buildMetadata({
  title: 'Browse wedding vendors',
  description: 'Search verified wedding vendors by category, city, budget, and rating.',
  path: '/vendors',
  noindex: true,
})

export default async function VendorsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseSearchParams(await searchParams)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-sand-900 text-3xl">Browse wedding vendors</h1>
      <p className="text-sand-600 mt-2 max-w-prose text-sm">
        Filter by category, city, budget, and rating. Only approved, published listings appear here.
      </p>

      <div className="mt-8">
        <Suspense fallback={<ResultsSkeleton />}>
          <SearchResults filters={filters} />
        </Suspense>
      </div>
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <li key={index}>
          <CardSkeleton />
        </li>
      ))}
    </ul>
  )
}
