'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

import {
  categoryIcon,
  categoryImage,
  categoryTint,
  vendorCountLabel,
} from '@/components/public/category-icons'
import { storagePublicUrl } from '@/lib/supabase/storage'
import { cn } from '@/lib/utils'
import type { CategoryTile } from '@/server/dal/homepage'

/**
 * Category cards (PRD 6.1.3) — the desktop presentation. Artwork, icons and
 * tints come from `category-icons`, shared with the mobile circles so one
 * category cannot pick up two different marks on the same page.
 *
 * Three ways a card can be illustrated, in order: the category's own artwork,
 * a real vendor's approved cover borrowed from the tile, and failing both a
 * gradient carrying the category icon. Every one of them fills the same box, so
 * drawing the remaining categories later cannot shift the layout.
 */

export function CategoryCarousel({
  categories,
  className,
}: {
  categories: CategoryTile[]
  className?: string
}) {
  const scroller = useRef<HTMLUListElement>(null)

  function scrollBy(direction: 1 | -1) {
    scroller.current?.scrollBy({ left: direction * 320, behavior: 'smooth' })
  }

  if (categories.length === 0) return null

  return (
    <div className={cn('relative', className)}>
      <ul
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
      >
        {categories.map((category, index) => {
          const Icon = categoryIcon(category.slug)
          const art = categoryImage(category.slug)
          const image = art ?? storagePublicUrl('vendor-media', category.imagePath)

          return (
            <li key={category.id} className="w-56 shrink-0 snap-start">
              <Link
                href={`/vendors/${category.slug}`}
                className="group relative flex aspect-4/5 flex-col justify-end overflow-hidden rounded-[var(--radius-panel)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[var(--shadow-float)]"
              >
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="224px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-0 flex items-center justify-center bg-gradient-to-br text-white/90',
                      categoryTint(index),
                    )}
                  >
                    <Icon className="size-12" strokeWidth={1.5} />
                  </span>
                )}

                {/* Bottom three-fifths only. Scrimming the whole card dims the
                    artwork it exists to show; the text never reaches above this
                    line, so neither does the darkening. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/55 to-transparent"
                />

                <div className="relative p-5">
                  <h3 className="font-display text-lg leading-tight text-white">{category.name}</h3>

                  {category.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-white/75">{category.description}</p>
                  ) : null}

                  <p className="mt-3 flex items-center gap-1 text-xs font-medium text-white/90">
                    {/* Counted live — never a decorative number (PRD 6.1). */}
                    {vendorCountLabel(category.vendorCount)}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 transition-transform group-hover:translate-x-1"
                    />
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Arrows are supplementary: the list scrolls and tabs natively. */}
      <div className="pointer-events-none absolute inset-y-0 -right-2 hidden items-center lg:flex">
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll categories forward"
          className="border-sand-200 text-sand-700 hover:border-brand-300 hover:text-brand-700 pointer-events-auto inline-flex size-11 items-center justify-center rounded-full border bg-white shadow-[var(--shadow-raised)] transition-colors"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 -left-2 hidden items-center lg:flex">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll categories back"
          className="border-sand-200 text-sand-700 hover:border-brand-300 hover:text-brand-700 pointer-events-auto inline-flex size-11 items-center justify-center rounded-full border bg-white shadow-[var(--shadow-raised)] transition-colors"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  )
}
