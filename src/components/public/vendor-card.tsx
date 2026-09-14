import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, Images, MapPin, Star } from 'lucide-react'

import { highlightIcon } from '@/components/public/amenity-icons'

import { SaveButton } from '@/components/public/save-button'
import { formatStartingPrice, money } from '@/lib/money'
import { storagePublicUrl } from '@/lib/supabase/storage'
import { cn } from '@/lib/utils'
import type { VendorSearchResult } from '@/server/dal/search'

/**
 * Vendor card (PRD 6.1.4, 6.2).
 *
 * Explicit `fill` + `sizes` keep CLS at zero (PRD 6.1 acceptance, 14.1), and a
 * featured result is labelled "Sponsored" — paid placement must never be
 * silent (PRD 6.2).
 *
 * The optional save control is a sibling of the card link, not a child: a
 * `<form>` inside an `<a>` is invalid HTML. `save` only asks for the control
 * to exist — it resolves its own session and saved state in the browser, so a
 * card never makes its page uncacheable (ADR-030).
 */
export function VendorCard({
  vendor,
  save = false,
  className,
}: {
  vendor: VendorSearchResult
  save?: boolean
  className?: string
}) {
  const cover = storagePublicUrl('vendor-media', vendor.coverPath)
  const startingPrice = vendor.startingAmountMinor
    ? formatStartingPrice(money(vendor.startingAmountMinor, vendor.currency))
    : null

  return (
    <article
      className={cn(
        'group border-sand-200 hover:border-brand-200 relative h-full overflow-hidden rounded-[var(--radius-panel)] border bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-float)]',
        className,
      )}
    >
      <Link href={`/vendor/${vendor.slug}`} className="block">
        <div className="bg-sand-100 relative aspect-4/3 overflow-hidden">
          {cover ? (
            <Image
              src={cover}
              alt={`Work by ${vendor.displayName}`}
              fill
              sizes="(max-width: 640px) 80vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              aria-hidden="true"
              className="from-brand-100 to-blush-100 font-display text-brand-300 flex h-full items-center justify-center bg-gradient-to-br text-4xl"
            >
              {vendor.displayName.charAt(0)}
            </div>
          )}

          {/* Top-left stack; the right corner belongs to the save control. */}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {vendor.isFeatured ? (
              <span className="bg-gold-500 text-sand-950 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                Sponsored
              </span>
            ) : null}
            {vendor.verificationStatus === 'verified' ? (
              <span className="text-sand-900 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase shadow-[var(--shadow-soft)] backdrop-blur">
                <BadgeCheck aria-hidden="true" className="text-brand-600 size-3" />
                Verified
              </span>
            ) : null}
            {vendor.ratingCount > 0 ? (
              <span className="text-sand-900 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold shadow-[var(--shadow-soft)] backdrop-blur">
                <Star aria-hidden="true" className="fill-gold-500 text-gold-500 size-3" />
                {vendor.ratingAverage.toFixed(1)}
              </span>
            ) : null}
          </div>

          {/* How much there is to look at, which is the first thing anyone
              scanning a grid of venues wants to know. Exact, not "31+": the
              count is known, and a "+" would imply more than there are. */}
          {vendor.photoCount > 1 ? (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <Images aria-hidden="true" className="size-3" />
              {vendor.photoCount}
              <span className="sr-only">photos</span>
            </span>
          ) : null}
        </div>

        <div className="p-4 sm:p-5">
          {/* Verification is badged on the artwork above, not repeated here. */}
          <h3 className="text-sand-900 group-hover:text-brand-700 font-medium transition-colors">
            <span className="line-clamp-1">{vendor.displayName}</span>
          </h3>

          {vendor.cityName ? (
            <p className="text-sand-500 mt-1 flex items-center gap-1 text-xs">
              <MapPin aria-hidden="true" className="size-3" />
              {vendor.cityName}
            </p>
          ) : null}

          {/* Headline facts from the vendor's own answers (PRD 6.2). Absent
              until they answer — a card never claims a capacity nobody gave. */}
          {vendor.highlights.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {vendor.highlights.map((highlight) => {
                const Icon = highlightIcon(highlight.code)
                return (
                  <li
                    key={highlight.code}
                    className="border-sand-200 text-sand-700 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                  >
                    <Icon aria-hidden="true" className="text-sand-400 size-3" />
                    <span className="font-medium tabular-nums">
                      {new Intl.NumberFormat('en-IN').format(highlight.value)}
                    </span>
                    {highlight.noun}
                  </li>
                )
              })}
            </ul>
          ) : null}

          <div className="border-sand-100 mt-4 flex items-end justify-between border-t pt-4">
            <div>
              {startingPrice ? (
                <>
                  <p className="text-sand-400 text-[11px] tracking-wide uppercase">Starting at</p>
                  <p className="text-sand-900 font-semibold">{startingPrice}</p>
                </>
              ) : (
                <p className="text-sand-500 text-sm">Price on request</p>
              )}
            </div>
            {vendor.ratingCount > 0 ? (
              <p className="text-sand-400 text-xs">{vendor.ratingCount} reviews</p>
            ) : (
              <p className="text-sand-400 text-xs">New</p>
            )}
          </div>
        </div>
      </Link>

      {save ? (
        <SaveButton
          vendorId={vendor.vendorId}
          vendorSlug={vendor.slug}
          vendorName={vendor.displayName}
          className="absolute top-3 right-3 z-10"
        />
      ) : null}
    </article>
  )
}
