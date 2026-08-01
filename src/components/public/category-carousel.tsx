'use client'

import Link from 'next/link'
import { useRef } from 'react'
import {
  ArrowRight,
  Building2,
  Cake,
  Camera,
  ChevronLeft,
  ChevronRight,
  Flower2,
  Gem,
  Music,
  Palette,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { CategoryTile } from '@/server/dal/homepage'

/**
 * Category cards (PRD 6.1.3).
 *
 * Icons are matched to the seeded category slugs with a neutral fallback, so
 * an admin adding a category never produces a broken tile — it just gets the
 * generic mark.
 */
const ICONS: Record<string, LucideIcon> = {
  venues: Building2,
  photographers: Camera,
  'makeup-artists': Sparkles,
  caterers: UtensilsCrossed,
  decorators: Flower2,
  'music-and-dj': Music,
  'mehendi-artists': Palette,
  planners: Gem,
  cakes: Cake,
}

/** Rotating gradient tints so a row of tiles is not monotone. */
const TINTS = [
  'from-brand-500 to-rose-500',
  'from-blush-500 to-brand-500',
  'from-rose-400 to-brand-600',
  'from-gold-500 to-blush-500',
  'from-brand-600 to-blush-600',
  'from-rose-500 to-gold-500',
]

export function CategoryCarousel({ categories }: { categories: CategoryTile[] }) {
  const scroller = useRef<HTMLUListElement>(null)

  function scrollBy(direction: 1 | -1) {
    scroller.current?.scrollBy({ left: direction * 320, behavior: 'smooth' })
  }

  if (categories.length === 0) return null

  return (
    <div className="relative">
      <ul
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
      >
        {categories.map((category, index) => {
          const Icon = ICONS[category.slug] ?? Sparkles
          return (
            <li key={category.id} className="w-56 shrink-0 snap-start">
              <Link
                href={`/vendors/${category.slug}`}
                className="group border-sand-200 hover:border-brand-200 relative flex h-full flex-col rounded-[var(--radius-panel)] border bg-white p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-[var(--shadow-float)]"
              >
                <span
                  className={cn(
                    'inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[var(--shadow-soft)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[4deg]',
                    TINTS[index % TINTS.length],
                  )}
                >
                  <Icon aria-hidden="true" className="size-6" strokeWidth={2} />
                </span>

                <h3 className="text-sand-900 group-hover:text-brand-700 mt-5 font-medium transition-colors">
                  {category.name}
                </h3>

                {category.description ? (
                  <p className="text-sand-500 mt-1 line-clamp-2 text-xs">{category.description}</p>
                ) : null}

                <p className="text-sand-400 group-hover:text-brand-600 mt-auto flex items-center gap-1 pt-4 text-xs font-medium transition-colors">
                  {/* Counted live — never a decorative number (PRD 6.1). */}
                  {category.vendorCount > 0
                    ? `${category.vendorCount} ${category.vendorCount === 1 ? 'vendor' : 'vendors'}`
                    : 'Coming soon'}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-hover:translate-x-1"
                  />
                </p>
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
