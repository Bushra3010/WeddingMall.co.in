'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Heart, LogOut, Menu, UserRound, X } from 'lucide-react'

import { site } from '@/lib/site'
import { cn } from '@/lib/utils'

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
  signedIn,
  signOutAction,
}: {
  signedIn: boolean
  signOutAction: () => Promise<void>
}) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the menu when the route changes. React's documented pattern for
  // resetting state on a prop change is to adjust during render — an effect
  // here would cause a second render pass on every navigation.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setMenuOpen(false)
  }

  const overHero = HERO_ROUTES.has(pathname)
  const solid = scrolled || !overHero || menuOpen

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
          <Link
            href="/account/shortlist"
            className={cn(
              'hidden items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors sm:inline-flex',
              solid
                ? 'text-sand-700 hover:bg-blush-100 hover:text-blush-600'
                : 'text-white/90 hover:bg-white/15',
            )}
          >
            <Heart aria-hidden="true" className="size-4" />
            Shortlist
          </Link>

          {signedIn ? (
            <>
              <Link
                href="/account"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  solid ? 'text-sand-700 hover:bg-sand-100' : 'text-white/90 hover:bg-white/15',
                )}
              >
                <UserRound aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Account</span>
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  className={cn(
                    'inline-flex items-center rounded-full p-2 transition-colors',
                    solid ? 'text-sand-600 hover:bg-sand-100' : 'text-white/80 hover:bg-white/15',
                  )}
                >
                  <LogOut aria-hidden="true" className="size-4" />
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/auth/sign-in"
              className={cn(
                'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                solid ? 'text-sand-700 hover:bg-sand-100' : 'text-white/90 hover:bg-white/15',
              )}
            >
              Sign in
            </Link>
          )}

          <Link
            href="/vendor/join"
            className="brand-gradient group relative hidden overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-raised)] transition-transform duration-200 hover:-translate-y-0.5 sm:inline-flex"
          >
            <span className="relative z-10">List your business</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition-opacity group-hover:opacity-100 motion-safe:group-hover:animate-[shimmer_1.2s_ease-out]"
            />
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className={cn(
              'inline-flex items-center rounded-full p-2 lg:hidden',
              solid ? 'text-sand-800 hover:bg-sand-100' : 'text-white hover:bg-white/15',
            )}
          >
            {menuOpen ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-sand-200 border-t bg-white px-4 py-3 lg:hidden"
        >
          <ul className="space-y-1">
            {[...NAV, { href: '/account/shortlist', label: 'Shortlist' }].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sand-800 hover:bg-brand-50 block rounded-lg px-3 py-2.5 text-sm font-medium"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/vendor/join"
                className="brand-gradient mt-2 block rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                List your business
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
