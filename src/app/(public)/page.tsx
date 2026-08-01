import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Headphones,
  MessageSquareText,
  Search,
  ShieldCheck,
  Star,
  Tag,
} from 'lucide-react'

import { CategoryCarousel } from '@/components/public/category-carousel'
import { CategoryCircles } from '@/components/public/category-circles'
import { Hero } from '@/components/public/hero'
import { StatStrip } from '@/components/public/stat-strip'
import { TestimonialCarousel } from '@/components/public/testimonial-carousel'
import { VendorRail } from '@/components/public/vendor-rail'
import { Reveal } from '@/components/shared/reveal'
import { EmptyState } from '@/components/ui/states'
import { buildMetadata } from '@/lib/seo'
import { site } from '@/lib/site'
import { cn } from '@/lib/utils'
import {
  getCategoryTiles,
  getHomeStats,
  getHomepageSections,
  getTestimonials,
} from '@/server/dal/homepage'
import { searchVendors } from '@/server/dal/search'
import { listCategories, listCities } from '@/server/dal/taxonomy'

export const metadata = buildMetadata({
  title: `${site.name} — ${site.tagline}`,
  path: '/',
})

// Public discovery is server-rendered and cached; moderation revalidates it
// (PRD 8.3).
export const revalidate = 300

const TRUST = [
  {
    icon: ShieldCheck,
    title: 'Verified businesses',
    body: 'Vendors submit documents before a listing can be published.',
  },
  {
    icon: Star,
    title: 'Genuine reviews',
    body: 'Only customers with a real enquiry can review, and every review is moderated.',
  },
  {
    icon: CalendarCheck,
    title: 'One enquiry, many quotes',
    body: 'Share your requirements once and compare replies side by side.',
  },
  {
    icon: Headphones,
    title: 'Your data stays yours',
    body: 'Contact details reach a vendor only when you choose to share them.',
  },
]

const STEPS = [
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
    icon: BadgeCheck,
    title: 'Decide with confidence',
    body: 'Read moderated reviews from customers who actually enquired.',
  },
]

export default async function HomePage() {
  const [sections, stats, categoryTiles, categories, cities, featured, testimonials] =
    await Promise.all([
      getHomepageSections(),
      getHomeStats(),
      getCategoryTiles(12),
      listCategories(20),
      listCities(60),
      searchVendors({ sort: 'recommended', limit: 8, page: 1 }),
      getTestimonials(5),
    ])

  const hero = sections.get('hero')
  const popular = categories.slice(0, 6)

  return (
    <>
      {/* Pulled up behind the sticky header so the bar floats over the hero. */}
      <div className="-mt-18">
        <Hero
          stats={stats}
          categories={categories}
          cities={cities}
          popular={popular}
          imagePath={typeof hero?.config.imagePath === 'string' ? hero.config.imagePath : null}
          eyebrow={
            typeof hero?.config.eyebrow === 'string'
              ? hero.config.eyebrow
              : 'Plan with verified wedding professionals'
          }
        />
      </div>

      {/*
        `pt-24` on mobile clears the search card that overhangs the hero's
        rounded edge by `-mb-14`.
      */}
      <section
        aria-labelledby="home-categories"
        className="mx-auto max-w-[90rem] px-4 pt-24 pb-12 sm:px-6 sm:py-20 lg:px-10"
      >
        <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div>
            <h2
              id="home-categories"
              className="font-display text-sand-900 text-2xl sm:text-3xl lg:text-4xl"
            >
              Browse by category
            </h2>
            <p className="text-sand-600 mt-1 hidden sm:mt-2 sm:block">
              Explore every kind of wedding professional.
            </p>
          </div>
          <Link
            href="/categories"
            className="text-brand-700 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
          >
            All categories
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Reveal>

        <Reveal delay={80} className="mt-6 sm:mt-10">
          {categoryTiles.length > 0 ? (
            <>
              {/* Same data, two layouts: circles on a phone, cards above `sm`. */}
              <CategoryCircles categories={categoryTiles.slice(0, 8)} className="sm:hidden" />
              <CategoryCarousel categories={categoryTiles} className="hidden sm:block" />
            </>
          ) : (
            <EmptyState
              title="Categories are being set up"
              description="An administrator has not published any categories yet."
            />
          )}
        </Reveal>

        {/*
          Hero carries these from `lg`, where it has room; below that they live
          here. The breakpoint matches the hero's own, so the figures appear
          exactly once at every width.
        */}
        <Reveal delay={140} className="mt-8 lg:hidden">
          <StatStrip stats={stats} />
        </Reveal>
      </section>

      {/* Featured vendors */}
      <section aria-labelledby="home-featured" className="bg-white py-12 sm:py-20">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <h2
                id="home-featured"
                className="font-display text-sand-900 text-2xl sm:text-3xl lg:text-4xl"
              >
                Featured vendors
              </h2>
              <p className="text-sand-600 mt-1 hidden sm:mt-2 sm:block">
                Highly rated businesses, ranked by reviews, responsiveness, and listing quality.
              </p>
            </div>
            <Link
              href="/vendors"
              className="text-brand-700 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
            >
              View all
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Reveal>

          {featured.results.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                title="No published vendors yet"
                description="Approved listings appear here as soon as vendors are verified."
                action={{ label: 'List your business', href: '/vendor/join' }}
              />
            </div>
          ) : (
            <VendorRail vendors={featured.results} save className="mt-6 gap-4 sm:mt-10 sm:gap-6" />
          )}
        </div>
      </section>

      {/* Trust bar */}
      <section
        aria-labelledby="home-trust"
        className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 sm:py-20 lg:px-10"
      >
        <h2 id="home-trust" className="sr-only">
          Why couples trust us
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {TRUST.map((item, index) => (
            <Reveal
              as="li"
              key={item.title}
              delay={index * 70}
              className="border-sand-200 rounded-[var(--radius-panel)] border bg-white p-5 transition-shadow hover:shadow-[var(--shadow-raised)] sm:p-6"
            >
              <span className="from-brand-500 inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br to-rose-500 text-white shadow-[var(--shadow-soft)]">
                <item.icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="text-sand-900 mt-4 font-medium">{item.title}</h3>
              <p className="text-sand-600 mt-1 text-sm">{item.body}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section
        aria-labelledby="home-how"
        className="from-brand-50 to-blush-50 bg-gradient-to-br py-12 sm:py-20"
      >
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <Reveal>
            <h2
              id="home-how"
              className="font-display text-sand-900 text-2xl sm:text-3xl lg:text-4xl"
            >
              How it works
            </h2>
            <p className="text-sand-600 mt-2">Three steps from browsing to booked.</p>
          </Reveal>

          <ol className="mt-6 grid gap-4 sm:mt-10 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step, index) => (
              <Reveal
                as="li"
                key={step.title}
                delay={index * 90}
                className="relative rounded-[var(--radius-panel)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7"
              >
                <span className="text-brand-100 font-display absolute top-5 right-6 text-5xl font-semibold">
                  {index + 1}
                </span>
                <span className="from-brand-600 to-blush-500 inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white">
                  <step.icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="text-sand-900 mt-4 font-medium">{step.title}</h3>
                <p className="text-sand-600 mt-1 text-sm">{step.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 ? (
        <section
          aria-labelledby="home-testimonials"
          className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-20"
        >
          <Reveal className="text-center">
            <h2
              id="home-testimonials"
              className="font-display text-sand-900 text-2xl sm:text-3xl lg:text-4xl"
            >
              Couples who planned with us
            </h2>
          </Reveal>
          <Reveal delay={80} className="mt-6 sm:mt-10">
            <TestimonialCarousel testimonials={testimonials} />
          </Reveal>
        </section>
      ) : null}

      {/* Vendor acquisition */}
      <section
        aria-labelledby="home-vendors"
        className="mx-auto max-w-[90rem] px-4 pb-16 sm:px-6 sm:pb-24 lg:px-10"
      >
        <Reveal
          className={cn(
            'relative overflow-hidden rounded-[var(--radius-panel)] p-8 text-center sm:p-16',
            'brand-gradient',
          )}
        >
          <div
            aria-hidden="true"
            className="absolute -top-20 -right-16 size-72 rounded-full bg-white/10 blur-3xl"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium text-white">
              <Tag aria-hidden="true" className="size-3.5" />
              Free to list
            </span>
            <h2
              id="home-vendors"
              className="font-display mt-5 text-2xl font-semibold text-white sm:text-3xl lg:text-4xl"
            >
              Are you a wedding professional?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">
              Showcase your work, receive qualified enquiries from couples who are actively
              planning, and manage every conversation in one place.
            </p>
            <Link
              href="/vendor/join"
              className="text-brand-700 mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold shadow-[var(--shadow-float)] transition-transform hover:-translate-y-0.5"
            >
              List your business
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
