import Link from 'next/link'

import { VendorCard } from '@/components/public/vendor-card'
import { EmptyState } from '@/components/ui/states'
import { buildSearchUrl, SORT_OPTIONS, type SearchFilters } from '@/features/search/filters'
import { searchVendors } from '@/server/dal/search'
import { listCities } from '@/server/dal/taxonomy'
import { cn } from '@/lib/utils'

/**
 * Shared results grid for /vendors, /vendors/[category], and
 * /vendors/[category]/[city]. Sorting and pagination are plain links, so the
 * page is fully usable without client JavaScript (PRD 14.1).
 */
export async function SearchResults({
  filters,
  basePath = '/vendors',
}: {
  filters: SearchFilters
  basePath?: string
}) {
  const [page, cities] = await Promise.all([searchVendors(filters), listCities(6)])
  const totalPages = Math.max(1, Math.ceil(page.total / filters.limit))

  if (page.results.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="No vendors match these filters yet"
          description="Try widening your budget, removing a filter, or looking at a nearby city."
        />
        {cities.length > 0 ? (
          <nav aria-label="Nearby cities" className="text-center">
            <p className="text-sand-600 text-sm">Browse another city</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {cities.map((city) => (
                <li key={city.id}>
                  <Link
                    href={buildSearchUrl({ category: filters.category, city: city.slug })}
                    className="border-sand-300 text-sand-700 hover:border-brand-300 inline-flex rounded-full border bg-white px-4 py-2 text-sm"
                  >
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sand-600 text-sm" aria-live="polite">
          {page.total} {page.total === 1 ? 'vendor' : 'vendors'}
        </p>

        <nav aria-label="Sort results" className="flex flex-wrap gap-1">
          {SORT_OPTIONS.map((option) => {
            const isActive = filters.sort === option.value
            return (
              <Link
                key={option.value}
                href={buildSearchUrl({ ...filters, sort: option.value, page: 1 }, basePath)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs',
                  isActive
                    ? 'bg-brand-700 text-white'
                    : 'border-sand-300 text-sand-700 hover:border-brand-300 border bg-white',
                )}
              >
                {option.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {page.results.map((vendor) => (
          <li key={vendor.vendorId}>
            <VendorCard vendor={vendor} />
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
          {filters.page > 1 ? (
            <Link
              href={buildSearchUrl({ ...filters, page: filters.page - 1 }, basePath)}
              rel="prev"
              className="border-sand-300 hover:border-brand-300 rounded-lg border bg-white px-4 py-2 text-sm"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-sand-600 px-2 text-sm">
            Page {filters.page} of {totalPages}
          </span>
          {filters.page < totalPages ? (
            <Link
              href={buildSearchUrl({ ...filters, page: filters.page + 1 }, basePath)}
              rel="next"
              className="border-sand-300 hover:border-brand-300 rounded-lg border bg-white px-4 py-2 text-sm"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  )
}
