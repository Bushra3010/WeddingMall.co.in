import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import type { Metadata } from 'next'

import { SearchResults } from '@/components/public/search-results'
import { CardSkeleton } from '@/components/ui/states'
import { parseSearchParams } from '@/features/search/filters'
import { breadcrumbSchema, buildMetadata } from '@/lib/seo'
import { getCategoryBySlug, listCities } from '@/server/dal/taxonomy'

type Params = Promise<{ categorySlug: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export const revalidate = 900

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categorySlug } = await params
  const category = await getCategoryBySlug(categorySlug)
  if (!category) return buildMetadata({ title: 'Category not found', noindex: true })

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
  const [category, cities] = await Promise.all([getCategoryBySlug(categorySlug), listCities(12)])
  if (!category) notFound()

  const filters = { ...parseSearchParams(await searchParams), category: category.slug }
  const basePath = `/vendors/${category.slug}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
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

      <nav aria-label="Breadcrumb" className="text-sand-500 text-xs">
        <ol className="flex gap-1.5">
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

      <h1 className="font-display text-sand-900 mt-3 text-3xl">{category.name} for weddings</h1>

      {/* Editable unique intro copy — required for an indexable page (PRD 11.2). */}
      {category.intro_html ? (
        <div
          className="prose prose-sm text-sand-700 mt-3 max-w-prose"
          dangerouslySetInnerHTML={{ __html: category.intro_html }}
        />
      ) : category.description ? (
        <p className="text-sand-600 mt-3 max-w-prose text-sm">{category.description}</p>
      ) : null}

      {cities.length > 0 ? (
        <nav aria-label="Cities" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {cities.map((city) => (
              <li key={city.id}>
                <Link
                  href={`/vendors/${category.slug}/${city.slug}`}
                  className="border-sand-300 text-sand-700 hover:border-brand-300 inline-flex rounded-full border bg-white px-3 py-1.5 text-xs"
                >
                  {category.name} in {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
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
