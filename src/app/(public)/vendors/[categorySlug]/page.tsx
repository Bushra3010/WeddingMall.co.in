import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import type { Metadata } from 'next'

import { FilterBar } from '@/components/public/filter-bar'
import { SearchResults } from '@/components/public/search-results'
import { CardSkeleton } from '@/components/ui/states'
import { parseSearchParams } from '@/features/search/filters'
import { breadcrumbSchema, buildMetadata } from '@/lib/seo'
import {
  getCategoryBySlug,
  listCities,
  resolveSlugRedirect,
  listFilterableAttributes,
} from '@/server/dal/taxonomy'

type Params = Promise<{ categorySlug: string }>
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
async function redirectRenamedSlug(slug: string) {
  const current = await resolveSlugRedirect('category', slug)
  if (current && current !== slug) permanentRedirect(`/vendors/${current}`)
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categorySlug } = await params
  const category = await getCategoryBySlug(categorySlug)
  if (!category) {
    await redirectRenamedSlug(categorySlug)
    return buildMetadata({ title: 'Category not found', noindex: true })
  }

  return buildMetadata({
    title: category.seo_title ?? `${category.name} for weddings`,
    description:
      category.seo_description ??
      `Compare ${category.name.toLowerCase()} for your wedding. See packages, portfolios, and moderated reviews.`,
    path: `/vendors/${category.slug}`,
  })
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { categorySlug } = await params
  const [category, cities, attributeFilters] = await Promise.all([
    getCategoryBySlug(categorySlug),
    listCities(12),
    listFilterableAttributes(categorySlug),
  ])
  if (!category) {
    await redirectRenamedSlug(categorySlug)
    notFound()
  }

  const filters = { ...parseSearchParams(await searchParams), category: category.slug }
  const basePath = `/vendors/${category.slug}`

  return (
    <div>
      <script
        type="application/ld+json"
        // Breadcrumb data mirrors the visible trail (PRD 6.3, 11.2).
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Vendors', path: '/vendors' },
              { name: category.name, path: basePath },
            ]),
          ),
        }}
      />

      {/*
        Centred banner. The subtitle is the category's own copy where it has
        any — a generic line repeated across every category page is exactly the
        thin, duplicated content PRD 11.2 wants these pages to avoid, and the
        description is the only text on the page that differs between them.
      */}
      <header className="from-blush-100 via-blush-50 to-sand-50 bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 sm:py-16">
          <nav aria-label="Breadcrumb" className="text-sand-500 mb-4 text-xs">
            <ol className="flex justify-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-brand-700">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/vendors" className="hover:text-brand-700">
                  Vendors
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-sand-700">
                {category.name}
              </li>
            </ol>
          </nav>

          <h1 className="font-display text-sand-900 text-3xl sm:text-4xl">{category.name}</h1>

          {category.intro_html ? (
            <div
              className="prose prose-sm text-sand-600 mx-auto mt-3 max-w-2xl"
              dangerouslySetInnerHTML={{ __html: category.intro_html }}
            />
          ) : (
            <p className="text-sand-600 mx-auto mt-3 max-w-2xl text-sm sm:text-base">
              {category.description ?? 'Discover the perfect service for your special day.'}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <FilterBar
          filters={filters}
          basePath={basePath}
          cities={cities}
          attributes={attributeFilters}
          categorySlug={category.slug}
        />

        <div className="mt-8">
          <Suspense fallback={<ResultsSkeleton />}>
            <SearchResults filters={filters} basePath={basePath} />
          </Suspense>
        </div>
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
