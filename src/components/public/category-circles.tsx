import Image from 'next/image'
import Link from 'next/link'

import { categoryIcon, categoryTint, vendorCountLabel } from '@/components/public/category-icons'
import { storagePublicUrl } from '@/lib/supabase/storage'
import { cn } from '@/lib/utils'
import type { CategoryTile } from '@/server/dal/homepage'

/**
 * Category circles — the mobile presentation of PRD 6.1.3.
 *
 * A four-across grid of round tiles reaches eight categories in the space the
 * desktop carousel spends on two, which is the whole point on a phone. The
 * desktop carousel still renders above `lg`; this is a different layout of the
 * same data, not a second source of truth.
 *
 * Tiles are square-cropped photographs when a vendor in the category has an
 * approved cover, and a gradient icon otherwise. Both paths reserve identical
 * space, so filling the site with real imagery later cannot shift the layout.
 */
export function CategoryCircles({
  categories,
  className,
}: {
  categories: CategoryTile[]
  className?: string
}) {
  if (categories.length === 0) return null

  return (
    <ul className={cn('grid grid-cols-4 gap-x-3 gap-y-6', className)}>
      {categories.map((category, index) => {
        const Icon = categoryIcon(category.slug)
        const image = storagePublicUrl('vendor-media', category.imagePath)

        return (
          <li key={category.id}>
            <Link
              href={`/vendors/${category.slug}`}
              className="group flex flex-col items-center gap-1.5 text-center"
            >
              <span
                className={cn(
                  'relative flex size-16 items-center justify-center overflow-hidden rounded-full text-white shadow-[var(--shadow-soft)] transition-transform duration-300 group-active:scale-95 sm:size-20',
                  !image && 'bg-gradient-to-br',
                  !image && categoryTint(index),
                )}
              >
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <Icon aria-hidden="true" className="size-6 sm:size-7" strokeWidth={1.75} />
                )}
              </span>

              {/*
                Two lines' worth of height whether the name wraps or not, so
                the counts underneath sit on one baseline across the row.
              */}
              <span className="text-sand-900 group-hover:text-brand-700 line-clamp-2 min-h-8 text-xs leading-tight font-medium transition-colors">
                {category.name}
              </span>

              {/* Counted live — never a decorative number (PRD 6.1). */}
              <span className="text-sand-500 text-[11px] leading-tight">
                {vendorCountLabel(category.vendorCount)}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
