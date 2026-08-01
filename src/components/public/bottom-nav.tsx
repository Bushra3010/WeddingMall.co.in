'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Building2,
  Compass,
  Heart,
  Home,
  LogOut,
  MapPin,
  Menu,
  Newspaper,
  Store,
  Tag,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'

import { useSession } from '@/components/shared/session-provider'
import { signOut } from '@/features/auth/actions'
import { cn } from '@/lib/utils'

/**
 * Bottom tab bar (PRD 6.1.1, 7.4) — the mobile replacement for the header's
 * hamburger menu.
 *
 * Four destinations reachable with a thumb, with everything else behind
 * "More". It renders below `lg` only; from `lg` the header carries the full
 * navigation and this would be redundant chrome.
 *
 * A fixed bar covers whatever is underneath it, so the component also emits a
 * spacer of its own height in normal flow. Without that the footer's last row
 * is unreachable — the page can be scrolled to its end and the content is
 * still behind the bar.
 */

const TABS: { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean }[] =
  [
    { href: '/', label: 'Home', icon: Home, match: (p) => p === '/' },
    {
      href: '/vendors',
      label: 'Explore',
      icon: Compass,
      // A vendor's own page belongs to browsing, so the tab stays lit there.
      match: (p) => p.startsWith('/vendors') || p.startsWith('/vendor/'),
    },
    {
      href: '/account/shortlist',
      label: 'Shortlist',
      icon: Heart,
      match: (p) => p.startsWith('/account/shortlist'),
    },
  ]

const MORE_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/cities', label: 'Cities', icon: MapPin },
  { href: '/blog', label: 'Wedding ideas', icon: Newspaper },
  { href: '/vendors/venues', label: 'Wedding venues', icon: Building2 },
]

export function BottomNav() {
  // Resolved in the browser so the server render stays cacheable (ADR-030).
  const { signedIn } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Reset on navigation. Adjusting during render is React's documented pattern
  // for this; an effect would cost a second render pass on every route change.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const moreActive = open || MORE_LINKS.some((item) => pathname.startsWith(item.href))

  return (
    <>
      {/*
        Keeps the end of the page clear of the fixed bar. The `1px` is the
        bar's top border, which sits outside its `h-16` content box — without
        it the footer's last line ends one pixel under the bar.
      */}
      <div
        aria-hidden="true"
        className="h-[calc(4rem+1px+env(safe-area-inset-bottom))] lg:hidden"
      />

      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="bg-sand-950/40 fixed inset-0 z-40 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      {open ? (
        <nav
          id="more-menu"
          aria-label="More"
          className="border-sand-200 fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 rounded-t-[var(--radius-panel)] border-t bg-white p-4 shadow-[var(--shadow-float)] motion-safe:animate-[reveal_0.25s_cubic-bezier(0.22,1,0.36,1)_both] lg:hidden"
        >
          <ul className="space-y-1">
            {MORE_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sand-800 hover:bg-brand-50 hover:text-brand-700 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium"
                >
                  <item.icon aria-hidden="true" className="text-sand-400 size-4.5" />
                  {item.label}
                </Link>
              </li>
            ))}

            <li className="border-sand-100 mt-2 border-t pt-2">
              <Link
                href={signedIn ? '/account' : '/auth/sign-in'}
                className="text-sand-800 hover:bg-brand-50 hover:text-brand-700 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium"
              >
                <UserRound aria-hidden="true" className="text-sand-400 size-4.5" />
                {signedIn ? 'Account' : 'Sign in'}
              </Link>
            </li>

            {signedIn ? (
              <li>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="text-sand-800 hover:bg-brand-50 hover:text-brand-700 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium"
                  >
                    <LogOut aria-hidden="true" className="text-sand-400 size-4.5" />
                    Sign out
                  </button>
                </form>
              </li>
            ) : null}

            <li>
              <Link
                href="/vendor/join"
                className="brand-gradient mt-2 flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white"
              >
                <Store aria-hidden="true" className="size-4" />
                List your business
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}

      <nav
        aria-label="Primary"
        className="border-sand-200 fixed inset-x-0 bottom-0 z-50 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_oklch(0.26_0.088_29/0.08)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex h-16 max-w-lg items-stretch">
          {TABS.map((tab) => {
            const active = tab.match(pathname)
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    active ? 'text-brand-700' : 'text-sand-500 hover:text-brand-600',
                  )}
                >
                  <tab.icon
                    aria-hidden="true"
                    className="size-5.5"
                    strokeWidth={active ? 2.4 : 1.8}
                  />
                  {tab.label}
                </Link>
              </li>
            )
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="more-menu"
              className={cn(
                'flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                moreActive ? 'text-brand-700' : 'text-sand-500 hover:text-brand-600',
              )}
            >
              {open ? (
                <X aria-hidden="true" className="size-5.5" strokeWidth={2.4} />
              ) : (
                <Menu aria-hidden="true" className="size-5.5" strokeWidth={1.8} />
              )}
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
