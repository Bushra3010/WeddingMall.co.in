'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

import { categoryIcon, categoryTint, vendorCountLabel } from '@/components/public/category-icons'
import { cn } from '@/lib/utils'
import type { CategoryTile } from '@/server/dal/homepage'

/**
 * Category cards (PRD 6.1.3) — the desktop presentation. Icons and tints come
 * from `category-icons`, shared with the mobile circles so one category cannot
 * pick up two different marks on the same page.
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
          return (
            <li key={category.id} className="w-56 shrink-0 snap-start">
              <Link
                href={`/vendors/${category.slug}`}
                className="group border-sand-200 hover:border-brand-200 relative flex h-full flex-col rounded-[var(--radius-panel)] border bg-white p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-[var(--shadow-float)]"
              >
                <span
                  className={cn(
                    'inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[var(--shadow-soft)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[4deg]',
                    categoryTint(index),
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
                  {vendorCountLabel(category.vendorCount)}
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
