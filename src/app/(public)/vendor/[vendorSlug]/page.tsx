import Image from 'next/image'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { BadgeCheck, MapPin, Star } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { formatDate } from '@/lib/dates'
import { formatRange, money } from '@/lib/money'
import { breadcrumbSchema, buildMetadata, vendorSchema } from '@/lib/seo'
import { storagePublicUrl } from '@/lib/supabase/storage'
import { cn } from '@/lib/utils'
import { ShortlistButton } from '@/components/customer/shortlist-button'
import { getActor } from '@/server/dal/actor'
import { isShortlisted } from '@/server/dal/enquiries'
import { getPublicVendor, getRatingDistribution, getVendorReviews } from '@/server/dal/vendors'
import { resolveSlugRedirect } from '@/server/dal/taxonomy'

type Params = Promise<{ vendorSlug: string }>

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
  const current = await resolveSlugRedirect('vendor', slug)
  if (current && current !== slug) permanentRedirect(`/vendor/${current}`)
}

export const revalidate = 600

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { vendorSlug } = await params
  const vendor = await getPublicVendor(vendorSlug)
  if (!vendor) {
    await redirectRenamedSlug(vendorSlug)
    return buildMetadata({ title: 'Vendor not found', noindex: true })
  }

  const cover = vendor.media.find((item) => item.is_cover) ?? vendor.media[0]

  return buildMetadata({
    title: vendor.display_name,
    description:
      vendor.about?.slice(0, 155) ??
      `${vendor.display_name}${vendor.city ? ` in ${vendor.city.name}` : ''} — packages, portfolio, and reviews.`,
    path: `/vendor/${vendor.slug}`,
    image: storagePublicUrl('vendor-media', cover?.storage_path) ?? undefined,
    type: 'profile',
  })
}

export default async function VendorProfilePage({ params }: { params: Params }) {
  const { vendorSlug } = await params
  const vendor = await getPublicVendor(vendorSlug)
  if (!vendor) {
    // Belt and braces — generateMetadata redirects first in practice.
    await redirectRenamedSlug(vendorSlug)
    notFound()
  }

  const actor = await getActor()
  const [reviews, distribution, shortlisted] = await Promise.all([
    getVendorReviews(vendor.id),
    getRatingDistribution(vendor.id),
    actor.userId ? isShortlisted(vendor.id) : Promise.resolve(false),
  ])

  const cover = vendor.media.find((item) => item.is_cover) ?? vendor.media[0]
  const gallery = vendor.media.filter((item) => item.id !== cover?.id).slice(0, 8)
  const primaryCategory = vendor.categories.find((row) => row.is_primary)?.categories ?? null

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            vendorSchema({
              name: vendor.display_name,
              slug: vendor.slug,
              description: vendor.about,
              city: vendor.city?.name ?? null,
              image: storagePublicUrl('vendor-media', cover?.storage_path),
              ratingAverage: Number(vendor.rating_average),
              // Only emitted when approved reviews are actually rendered below.
              ratingCount: reviews.length > 0 ? Number(vendor.rating_count) : 0,
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Vendors', path: '/vendors' },
              ...(primaryCategory
                ? [{ name: primaryCategory.name, path: `/vendors/${primaryCategory.slug}` }]
                : []),
              { name: vendor.display_name, path: `/vendor/${vendor.slug}` },
            ]),
          ),
        }}
      />

      {/* Cover */}
      <div className="bg-sand-100 relative aspect-16/7 overflow-hidden rounded-[var(--radius-card)]">
        {cover ? (
          <Image
            src={storagePublicUrl('vendor-media', cover.storage_path)!}
            alt={cover.alt_text ?? `Work by ${vendor.display_name}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-10">
          <header>
            <h1 className="font-display text-sand-900 flex flex-wrap items-center gap-2 text-3xl">
              {vendor.display_name}
              {vendor.verification_status === 'verified' ? (
                <span className="bg-brand-50 text-brand-700 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
                  <BadgeCheck aria-hidden="true" className="size-3.5" />
                  Verified
                </span>
              ) : null}
            </h1>

            <div className="text-sand-600 mt-2 flex flex-wrap items-center gap-4 text-sm">
              {primaryCategory ? (
                <Link href={`/vendors/${primaryCategory.slug}`} className="hover:text-brand-700">
                  {primaryCategory.name}
                </Link>
              ) : null}
              {vendor.city ? (
                <span className="flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-4" />
                  {vendor.city.name}
                </span>
              ) : null}
              {Number(vendor.rating_count) > 0 ? (
                <span className="text-sand-800 flex items-center gap-1">
                  <Star aria-hidden="true" className="fill-accent-500 text-accent-500 size-4" />
                  {Number(vendor.rating_average).toFixed(1)}
                  <span className="text-sand-500">({vendor.rating_count} reviews)</span>
                </span>
              ) : null}
            </div>
          </header>

          {vendor.about ? (
            <section aria-labelledby="vendor-about">
              <h2 id="vendor-about" className="font-display text-sand-900 text-xl">
                About
              </h2>
              <p className="text-sand-700 mt-2 text-sm leading-relaxed whitespace-pre-line">
                {vendor.about}
              </p>
              {vendor.experience_years ? (
                <p className="text-sand-600 mt-3 text-sm">
                  {vendor.experience_years} years in business
                </p>
              ) : null}
            </section>
          ) : null}

          {gallery.length > 0 ? (
            <section aria-labelledby="vendor-portfolio">
              <h2 id="vendor-portfolio" className="font-display text-sand-900 text-xl">
                Portfolio
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {gallery.map((item) => (
                  <li
                    key={item.id}
                    className="bg-sand-100 relative aspect-square overflow-hidden rounded-lg"
                  >
                    <Image
                      src={storagePublicUrl('vendor-media', item.storage_path)!}
                      alt={item.alt_text ?? ''}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {vendor.packages.length > 0 ? (
            <section aria-labelledby="vendor-packages">
              <h2 id="vendor-packages" className="font-display text-sand-900 text-xl">
                Packages
              </h2>
              <ul className="mt-3 space-y-3">
                {vendor.packages.map((pkg) => {
                  const price = formatRange(
                    pkg.min_amount_minor ? money(pkg.min_amount_minor, pkg.currency) : null,
                    pkg.max_amount_minor ? money(pkg.max_amount_minor, pkg.currency) : null,
                  )
                  return (
                    <li
                      key={pkg.id}
                      className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sand-900 font-medium">{pkg.name}</h3>
                        {price ? (
                          <p className="text-brand-700 text-sm font-medium">
                            {pkg.price_type === 'starting_at' ? 'From ' : ''}
                            {price}
                            {pkg.unit ? <span className="text-sand-500"> / {pkg.unit}</span> : null}
                          </p>
                        ) : (
                          <p className="text-sand-500 text-sm">Price on request</p>
                        )}
                      </div>
                      {pkg.description ? (
                        <p className="text-sand-600 mt-1 text-sm">{pkg.description}</p>
                      ) : null}
                      {pkg.inclusions_json?.length ? (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {pkg.inclusions_json.map((item) => (
                            <li
                              key={item}
                              className="bg-sand-100 text-sand-700 rounded-full px-2 py-0.5 text-xs"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="vendor-reviews">
            <h2 id="vendor-reviews" className="font-display text-sand-900 text-xl">
              Reviews
            </h2>

            {reviews.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="No reviews yet"
                  description="Reviews appear here once customers who enquired have shared their experience and moderation is complete."
                />
              </div>
            ) : (
              <>
                <ul className="mt-3 space-y-1.5" aria-label="Rating distribution">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = distribution[stars] ?? 0
                    const percent =
                      reviews.length > 0
                        ? Math.round((count / Number(vendor.rating_count)) * 100)
                        : 0
                    return (
                      <li key={stars} className="text-sand-600 flex items-center gap-2 text-xs">
                        <span className="w-8">{stars}★</span>
                        <span className="bg-sand-200 h-2 flex-1 overflow-hidden rounded-full">
                          <span
                            className="bg-accent-500 block h-full"
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                        <span className="w-8 text-right">{count}</span>
                      </li>
                    )
                  })}
                </ul>

                <ul className="mt-6 space-y-4">
                  {reviews.map((review) => (
                    <li
                      key={review.id}
                      className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className="text-accent-700 flex items-center gap-0.5"
                          aria-label={`${review.overall_rating} out of 5`}
                        >
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              aria-hidden="true"
                              className={cn(
                                'size-3.5',
                                index < review.overall_rating
                                  ? 'fill-accent-500 text-accent-500'
                                  : 'text-sand-300',
                              )}
                            />
                          ))}
                        </span>
                        <span className="text-sand-900 font-medium">
                          {review.customer_name ?? 'Verified customer'}
                        </span>
                        <span className="text-sand-500 text-xs">
                          {formatDate(review.created_at)}
                        </span>
                      </div>

                      {review.title ? (
                        <h3 className="text-sand-900 mt-2 font-medium">{review.title}</h3>
                      ) : null}
                      {review.body ? (
                        <p className="text-sand-700 mt-1 text-sm">{review.body}</p>
                      ) : null}

                      {review.response ? (
                        <div className="bg-sand-50 mt-3 rounded-lg p-3">
                          <p className="text-sand-700 text-xs font-medium">
                            Response from {vendor.display_name}
                          </p>
                          <p className="text-sand-600 mt-1 text-sm">{review.response.body}</p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        {/* Sticky enquiry rail (PRD 6.3). Contact details are never printed:
            they are shared only after consent and lead assignment. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <p className="font-display text-sand-900 text-lg">Interested?</p>
            <p className="text-sand-600 mt-1 text-sm">
              Send your requirements. You choose whether to share your contact details.
            </p>
            <Link
              href={`/vendor/${vendor.slug}/enquire`}
              className={cn(buttonVariants({ size: 'lg' }), 'mt-4 w-full')}
            >
              Request a quote
            </Link>
            {actor.userId ? (
              <ShortlistButton
                vendorId={vendor.id}
                vendorSlug={vendor.slug}
                shortlisted={shortlisted}
                className="mt-2"
              />
            ) : (
              <Link
                href={`/auth/sign-in?next=${encodeURIComponent(`/vendor/${vendor.slug}`)}`}
                className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 w-full')}
              >
                Sign in to save
              </Link>
            )}

            {vendor.serviceAreas.length > 0 ? (
              <div className="border-sand-200 mt-5 border-t pt-4">
                <h2 className="text-sand-900 text-sm font-medium">Serves</h2>
                <p className="text-sand-600 mt-1 text-xs">
                  {vendor.serviceAreas
                    .map((row) => row.cities?.name)
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
