import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import type { Metadata } from 'next'

import { AttributeFilters } from '@/components/public/attribute-filters'
import { SearchResults } from '@/components/public/search-results'
import { CardSkeleton } from '@/components/ui/states'
import { parseSearchParams } from '@/features/search/filters'
import { breadcrumbSchema, buildMetadata } from '@/lib/seo'
import {
  getCategoryBySlug,
  getCityBySlug,
  resolveSlugRedirect,
  listFilterableAttributes,
} from '@/server/dal/taxonomy'

type Params = Promise<{ categorySlug: string; citySlug: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export const revalidate = 900

/**
 * Renamed slugs must redirect BEFORE the response starts streaming.
 *
 * generateMetadata resolves before the shell is flushed, so a redirect raised
 * there produces a real 308. Raising it inside the page component happens after
 * the first bytes are out, and Next degrades to an HTTP 200 carrying a
 * meta-refresh — which a crawler reads as a 200 "not found" page, exactly the
 * outcome PRD 11.2 is trying to avoid.
 */
async function redirectRenamedSlugs(categorySlug: string, citySlug: string) {
  const [nextCategory, nextCity] = await Promise.all([
    resolveSlugRedirect('category', categorySlug),
    resolveSlugRedirect('city', citySlug),
  ])
  if (nextCategory || nextCity) {
    permanentRedirect(`/vendors/${nextCategory ?? categorySlug}/${nextCity ?? citySlug}`)
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categorySlug, citySlug } = await params
  const [category, city] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getCityBySlug(citySlug),
  ])
  if (!category || !city) {
    await redirectRenamedSlugs(categorySlug, citySlug)
    return buildMetadata({ title: 'Page not found', noindex: true })
  }

  return buildMetadata({
    title: `${category.name} in ${city.name}`,
    description: `Compare ${category.name.toLowerCase()} in ${city.name}. Verified businesses, published packages, and moderated reviews.`,
    path: `/vendors/${category.slug}/${city.slug}`,
  })
}

/**
 * The primary SEO landing route (PRD 11.1). Only real category × city
 * combinations resolve; the pair is validated against the taxonomy so the site
 * cannot generate thousands of thin pages (PRD 11.2).
 */
export default async function CategoryCityPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { categorySlug, citySlug } = await params
  const [category, city, attributeFilters] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getCityBySlug(citySlug),
    listFilterableAttributes(categorySlug),
  ])
  if (!category || !city) {
    await redirectRenamedSlugs(categorySlug, citySlug)
    notFound()
  }

  const basePath = `/vendors/${category.slug}/${city.slug}`
  const filters = {
    ...parseSearchParams(await searchParams),
    category: category.slug,
    city: city.slug,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Vendors', path: '/vendors' },
              { name: category.name, path: `/vendors/${category.slug}` },
              { name: city.name, path: basePath },
            ]),
          ),
        }}
      />

      <nav aria-label="Breadcrumb" className="text-sand-500 text-xs">
        <ol className="flex flex-wrap gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand-700">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/vendors/${category.slug}`} className="hover:text-brand-700">
              {category.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-sand-700">
            {city.name}
          </li>
        </ol>
      </nav>

      <h1 className="font-display text-sand-900 mt-3 text-3xl">
        {category.name} in {city.name}
      </h1>

      {city.intro_html ? (
        <div
          className="prose prose-sm text-sand-700 mt-3 max-w-prose"
          dangerouslySetInnerHTML={{ __html: city.intro_html }}
        />
      ) : null}

      {attributeFilters.length > 0 ? (
        <div className="border-sand-200 mt-6 rounded-[var(--radius-card)] border bg-white p-4">
          <AttributeFilters attributes={attributeFilters} filters={filters} basePath={basePath} />
        </div>
      ) : null}

      <div className="mt-8">
        <Suspense fallback={<ResultsSkeleton />}>
          <SearchResults filters={filters} basePath={basePath} />
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
