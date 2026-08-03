'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

/**
 * Section navigation for the customer and vendor workspaces.
 *
 * Two jobs, both of which were previously missing on a phone.
 *
 * **It has to fit.** The list is a grid item, and a grid item's default
 * `min-width: auto` refuses to shrink below its content — so the fourteen
 * vendor links forced the column to 1221px, the document to 1237px, and the
 * browser zoomed the whole page out to fit. That is why the header appeared to
 * cover only part of the screen: it was correctly 390px wide on a page that had
 * become 1237px. `min-w-0` lets the column shrink, which is what finally lets
 * the `overflow-x-auto` below it do its job.
 *
 * **It has to say where you are.** Neither workspace marked the current
 * section. On a strip that scrolls past its own edge that leaves nothing to
 * orient by, so the active link is marked, given `aria-current`, and scrolled
 * into view on arrival — landing on "Settings" and seeing "Overview" is the
 * same problem in a different form.
 */

export type DashboardNavItem = { href: string; label: string }

export function DashboardNav({
  items,
  label,
  /** The index route, which every other href is a prefix of. */
  rootHref,
  sticky = 'lg:top-6',
}: {
  items: DashboardNavItem[]
  label: string
  rootHref: string
  sticky?: string
}) {
  const pathname = usePathname()
  const activeRef = useRef<HTMLAnchorElement | null>(null)

  // The root is matched exactly because every other href starts with it. The
  // rest match on a segment boundary rather than a bare prefix, so a future
  // `/plan` and `/planning` cannot both light up.
  const isActive = (href: string) =>
    href === rootHref
      ? pathname === rootHref
      : pathname === href || pathname.startsWith(`${href}/`)

  useEffect(() => {
    // Only nudges the strip sideways; `block: 'nearest'` keeps it from
    // scrolling the page itself on desktop, where the list is vertical.
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])

  return (
    <nav aria-label={label} className={cn('min-w-0 lg:sticky lg:self-start', sticky)}>
      <ul
        className={cn(
          // A tab strip on a phone, a sidebar from `lg`. `scroll-px-4` keeps
          // the first item off the edge when it snaps.
          'border-sand-200 -mx-4 flex scroll-px-4 gap-1 overflow-x-auto border-b px-4 pb-2',
          'lg:mx-0 lg:flex-col lg:overflow-visible lg:border-0 lg:px-0 lg:pb-0',
          // The scrollbar is noise on a strip this short; the overflow is
          // obvious from the clipped item at the edge.
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {items.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href} className="shrink-0">
              <Link
                ref={active ? activeRef : undefined}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-sand-700 hover:bg-white lg:hover:bg-white',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
