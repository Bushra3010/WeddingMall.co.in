'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Heart, UserRound } from 'lucide-react'

import { CitySelector } from '@/components/public/city-selector'
import { useSession } from '@/components/shared/session-provider'
import { SignOutButton } from '@/components/shared/sign-out-button'
import { site } from '@/lib/site'
import { cn } from '@/lib/utils'
import type { CityRow } from '@/server/dal/taxonomy'

/**
 * Sticky navigation (PRD 6.1.1).
 *
 * Transparent over the homepage hero, solid everywhere else and on scroll.
 * Whether a page has a hero is derived from the path here rather than threaded
 * through the layout — the layout renders the header for every public route and
 * cannot know what the page below it looks like.
 *
 * Every link points at a route that exists — a nav full of 404s looks worse
 * than a shorter one.
 *
 * Below `lg` the bar carries only the wordmark and the city selector:
 * `BottomNav` owns navigation at that width, and duplicating its destinations
 * up here would leave two competing menus in a bar too narrow for either.
 */

const NAV = [
  { href: '/vendors', label: 'Browse vendors' },
  { href: '/categories', label: 'Categories' },
  { href: '/cities', label: 'Cities' },
  { href: '/blog', label: 'Wedding ideas' },
]

/** Routes that render a dark full-bleed hero behind the bar. */
const HERO_ROUTES = new Set(['/'])

export function SiteHeader({
  cities = [],
}: {
  /**
   * Optional: the city switcher is a discovery control, so the account area
   * renders the same header without it rather than paying for the query. The
   * selector renders nothing when the list is empty.
   */
  cities?: CityRow[]
}) {
  // Resolved in the browser so the server render stays cacheable (ADR-030).
  const { signedIn } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const overHero = HERO_ROUTES.has(pathname)
  const solid = scrolled || !overHero

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        solid
          ? 'glass-panel border-sand-200/70 border-b shadow-[var(--shadow-soft)]'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-18 max-w-[90rem] items-center gap-6 px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          className={cn(
            'font-display text-2xl font-semibold tracking-tight transition-colors',
            solid ? 'text-brand-700' : 'text-white',
          )}
        >
          {site.name}
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                solid
                  ? 'text-sand-700 hover:bg-brand-50 hover:text-brand-700'
                  : 'text-white/90 hover:bg-white/15 hover:text-white',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <CitySelector cities={cities} variant={solid ? 'dark' : 'light'} />

          <Link
            href="/account/shortlist"
            className={cn(
              'hidden items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors lg:inline-flex',
              solid
                ? 'text-sand-700 hover:bg-blush-100 hover:text-blush-600'
                : 'text-white/90 hover:bg-white/15',
            )}
          >
            <Heart aria-hidden="true" className="size-4" />
            Shortlist
          </Link>

          {/*
            Everything from here down is `lg` and up only. Below that the
            bottom tab bar owns navigation, so repeating these in the header
            would be duplicate controls competing for a narrow bar.
          */}
          {signedIn ? (
            <>
              <Link
                href="/account"
                className={cn(
                  'hidden items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors lg:inline-flex',
                  solid ? 'text-sand-700 hover:bg-sand-100' : 'text-white/90 hover:bg-white/15',
                )}
              >
                <UserRound aria-hidden="true" className="size-4" />
                Account
              </Link>
              {/*
                The shared button, not a second inline form. The old copy here
                was icon-only — indistinguishable from a decoration, and read
                by people as "there is no sign-out button" — and it bypassed
                the client-side session clearing in `SignOutButton`, so the
                header went on showing "Account" to somebody who had signed
                out.
              */}
              <SignOutButton
                className={cn(
                  'hidden rounded-full px-3 py-2 text-sm font-medium transition-colors lg:inline-flex',
                  solid ? 'text-sand-700 hover:bg-sand-100' : 'text-white/90 hover:bg-white/15',
                )}
              />
            </>
          ) : (
            <Link
              href="/auth/sign-in"
              className={cn(
                'hidden rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors lg:inline-block',
                solid ? 'text-sand-700 hover:bg-sand-100' : 'text-white/90 hover:bg-white/15',
              )}
            >
              Sign in
            </Link>
          )}

          <Link
            href="/vendor/join"
            className="brand-gradient group relative hidden overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-raised)] transition-transform duration-200 hover:-translate-y-0.5 lg:inline-flex"
          >
            <span className="relative z-10">List your business</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition-opacity group-hover:opacity-100 motion-safe:group-hover:animate-[shimmer_1.2s_ease-out]"
            />
          </Link>
        </div>
      </div>
    </header>
  )
}
