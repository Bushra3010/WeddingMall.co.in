import Link from 'next/link'
import { BadgeCheck, MessageSquareText, Search, ShieldCheck, Star } from 'lucide-react'

import { VendorCard } from '@/components/public/vendor-card'
import { HeroSearch } from '@/components/public/hero-search'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { buildMetadata } from '@/lib/seo'
import { site } from '@/lib/site'
import { cn } from '@/lib/utils'
import { searchVendors } from '@/server/dal/search'
import { listCategories, listCities } from '@/server/dal/taxonomy'

export const metadata = buildMetadata({
  title: `${site.name} — ${site.tagline}`,
  path: '/',
})

// Public discovery is server-rendered and cached; moderation/publishing
// revalidates it (PRD 8.3).
export const revalidate = 300

export default async function HomePage() {
  const [categories, cities, featured] = await Promise.all([
    listCategories(8),
    listCities(8),
    searchVendors({ sort: 'recommended', limit: 8, page: 1, verifiedOnly: false }),
  ])

  return (
    <>
      {/* Hero */}
      <section className="from-brand-50 to-sand-50 bg-gradient-to-b">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="font-display text-brand-900 text-4xl font-semibold sm:text-5xl">
            Plan your wedding with people you can trust
          </h1>
          <p className="text-sand-700 mx-auto mt-4 max-w-xl text-base sm:text-lg">
            {site.description}
          </p>
          <div className="mt-8 text-left">
            <HeroSearch categories={categories} cities={cities} />
          </div>
        </div>
      </section>

      {/* Popular categories */}
      <section aria-labelledby="home-categories" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 id="home-categories" className="font-display text-sand-900 text-2xl sm:text-3xl">
            Browse by category
          </h2>
          <Link href="/categories" className="text-brand-700 text-sm font-medium hover:underline">
            All categories
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Categories are being set up"
              description="An administrator has not published any categories yet."
            />
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/vendors/${category.slug}`}
                  className="border-sand-200 hover:border-brand-300 flex h-full flex-col rounded-[var(--radius-card)] border bg-white p-4 transition-colors"
                >
                  <span className="text-sand-900 font-medium">{category.name}</span>
                  {category.description ? (
                    <span className="text-sand-600 mt-1 line-clamp-2 text-xs">
                      {category.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Featured vendors */}
      <section aria-labelledby="home-featured" className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 id="home-featured" className="font-display text-sand-900 text-2xl sm:text-3xl">
              Featured vendors
            </h2>
            <Link href="/vendors" className="text-brand-700 text-sm font-medium hover:underline">
              Browse all
            </Link>
          </div>

          {featured.results.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No published vendors yet"
                description="Approved listings appear here as soon as vendors are verified."
                action={{ label: 'List your business', href: '/vendor/join' }}
              />
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featured.results.map((vendor) => (
                <li key={vendor.vendorId}>
                  <VendorCard vendor={vendor} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="home-how" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 id="home-how" className="font-display text-sand-900 text-2xl sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Search,
              title: 'Search and compare',
              body: 'Filter by category, city, budget, and rating to build a realistic shortlist.',
            },
            {
              icon: MessageSquareText,
              title: 'Send one enquiry',
              body: 'Share your requirements once. Vendors reply in a thread you control.',
            },
            {
              icon: Star,
              title: 'Decide with confidence',
              body: 'Read moderated reviews from customers who actually enquired.',
            },
          ].map((step, index) => (
            <li
              key={step.title}
              className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5"
            >
              <step.icon aria-hidden="true" className="text-brand-600 size-5" />
              <h3 className="text-sand-900 mt-3 font-medium">
                {index + 1}. {step.title}
              </h3>
              <p className="text-sand-600 mt-1 text-sm">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust */}
      <section aria-labelledby="home-trust" className="bg-brand-900 py-14 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="home-trust" className="font-display text-2xl sm:text-3xl">
            Why couples trust us
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: BadgeCheck,
                title: 'Verified businesses',
                body: 'Vendors submit documents before a listing can be published.',
              },
              {
                icon: Star,
                title: 'Genuine reviews',
                body: 'Only customers with a real enquiry can review, and every review is moderated.',
              },
              {
                icon: ShieldCheck,
                title: 'Your data stays yours',
                body: 'Your contact details are shared with a vendor only when you consent.',
              },
            ].map((item) => (
              <li key={item.title} className="bg-brand-800 rounded-[var(--radius-card)] p-5">
                <item.icon aria-hidden="true" className="text-accent-300 size-5" />
                <h3 className="mt-3 font-medium">{item.title}</h3>
                <p className="text-brand-100 mt-1 text-sm">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Vendor acquisition */}
      <section aria-labelledby="home-vendors" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-8 text-center">
          <h2 id="home-vendors" className="font-display text-sand-900 text-2xl sm:text-3xl">
            Are you a wedding professional?
          </h2>
          <p className="text-sand-600 mx-auto mt-2 max-w-prose text-sm">
            Showcase your work, receive qualified enquiries, and grow your wedding business.
          </p>
          <Link href="/vendor/join" className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}>
            List your business
          </Link>
        </div>
      </section>

      {/* Popular cities — SEO links */}
      {cities.length > 0 ? (
        <section aria-labelledby="home-cities" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <h2 id="home-cities" className="font-display text-sand-900 text-2xl sm:text-3xl">
            Popular cities
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cities.map((city) => (
              <li key={city.id}>
                <Link
                  href={`/vendors?city=${city.slug}`}
                  className="border-sand-300 text-sand-700 hover:border-brand-300 hover:text-brand-700 inline-flex rounded-full border bg-white px-4 py-2 text-sm"
                >
                  {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
