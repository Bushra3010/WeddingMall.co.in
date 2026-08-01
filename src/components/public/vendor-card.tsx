import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, MapPin, Star } from 'lucide-react'

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
 */
export function VendorCard({
  vendor,
  className,
}: {
  vendor: VendorSearchResult
  className?: string
}) {
  const cover = storagePublicUrl('vendor-media', vendor.coverPath)
  const startingPrice = vendor.startingAmountMinor
    ? formatStartingPrice(money(vendor.startingAmountMinor, vendor.currency))
    : null

  return (
    <article
      className={cn(
        'group border-sand-200 hover:border-brand-200 h-full overflow-hidden rounded-[var(--radius-panel)] border bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-float)]',
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
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
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

          {/* Rating chip, top-left */}
          {vendor.ratingCount > 0 ? (
            <span className="text-sand-900 absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold shadow-[var(--shadow-soft)] backdrop-blur">
              <Star aria-hidden="true" className="fill-gold-500 text-gold-500 size-3" />
              {vendor.ratingAverage.toFixed(1)}
            </span>
          ) : null}

          {/* Verified badge, top-right */}
          {vendor.verificationStatus === 'verified' ? (
            <span className="text-brand-700 absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold shadow-[var(--shadow-soft)] backdrop-blur">
              <BadgeCheck aria-hidden="true" className="size-3.5" />
              Verified
            </span>
          ) : null}

          {vendor.isFeatured ? (
            <span className="bg-gold-500 text-sand-950 absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold">
              Sponsored
            </span>
          ) : null}
        </div>

        <div className="p-5">
          <h3 className="text-sand-900 group-hover:text-brand-700 line-clamp-1 font-medium transition-colors">
            {vendor.displayName}
          </h3>

          {vendor.cityName ? (
            <p className="text-sand-500 mt-1 flex items-center gap-1 text-xs">
              <MapPin aria-hidden="true" className="size-3" />
              {vendor.cityName}
            </p>
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
    </article>
  )
}
