import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, Star } from 'lucide-react'

import { formatStartingPrice, money } from '@/lib/money'
import { storagePublicUrl } from '@/lib/supabase/storage'
import type { VendorSearchResult } from '@/server/dal/search'

/**
 * Explicit width/height and `sizes` keep CLS at zero (PRD 6.1 acceptance,
 * 14.1). `is_featured` results are labelled — sponsored placement must never be
 * silent (PRD 6.2).
 */
export function VendorCard({ vendor }: { vendor: VendorSearchResult }) {
  const cover = storagePublicUrl('vendor-media', vendor.coverPath)
  const startingPrice = vendor.startingAmountMinor
    ? formatStartingPrice(money(vendor.startingAmountMinor, vendor.currency))
    : null

  return (
    <article className="group border-sand-200 h-full overflow-hidden rounded-[var(--radius-card)] border bg-white transition-shadow hover:shadow-md">
      <Link href={`/vendor/${vendor.slug}`} className="block">
        <div className="bg-sand-100 relative aspect-4/3">
          {cover ? (
            <Image
              src={cover}
              alt={`Work by ${vendor.displayName}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="font-display text-sand-300 flex h-full items-center justify-center text-3xl"
            >
              {vendor.displayName.charAt(0)}
            </div>
          )}
          {vendor.isFeatured ? (
            <span className="bg-accent-500 text-sand-950 absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-medium">
              Sponsored
            </span>
          ) : null}
        </div>

        <div className="p-4">
          <h3 className="text-sand-900 flex items-center gap-1.5 font-medium">
            <span className="line-clamp-1">{vendor.displayName}</span>
            {vendor.verificationStatus === 'verified' ? (
              <BadgeCheck
                aria-label="Verified business"
                className="text-brand-600 size-4 shrink-0"
              />
            ) : null}
          </h3>

          {vendor.cityName ? (
            <p className="text-sand-600 mt-0.5 text-xs">{vendor.cityName}</p>
          ) : null}

          <div className="mt-2 flex items-center gap-3 text-sm">
            {vendor.ratingCount > 0 ? (
              <span className="text-sand-800 flex items-center gap-1">
                <Star aria-hidden="true" className="fill-accent-500 text-accent-500 size-3.5" />
                {vendor.ratingAverage.toFixed(1)}
                <span className="text-sand-500">({vendor.ratingCount})</span>
              </span>
            ) : (
              <span className="text-sand-500 text-xs">No reviews yet</span>
            )}
          </div>

          {startingPrice ? (
            <p className="text-sand-700 mt-2 text-sm">
              <span className="text-sand-500">From </span>
              <span className="font-medium">{startingPrice}</span>
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  )
}
