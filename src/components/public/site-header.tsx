import Link from 'next/link'
import { Heart, Search, UserRound } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { SignOutButton } from '@/components/shared/sign-out-button'
import { site } from '@/lib/site'
import { cn } from '@/lib/utils'
import { getActor } from '@/server/dal/actor'

/**
 * PRD 6.1.1 — logo, vendor navigation, city selector, search, sign-in, and
 * "List your business". Server Component: the signed-in state is rendered on
 * the server so the header does not flash.
 */
export async function SiteHeader() {
  const actor = await getActor()
  const signedIn = Boolean(actor.userId)

  return (
    <header className="border-sand-200 sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="font-display text-brand-800 text-xl font-semibold">
          {site.name}
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <Link href="/vendors" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Browse vendors
          </Link>
          <Link href="/categories" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Categories
          </Link>
          <Link href="/cities" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Cities
          </Link>
          <Link href="/blog" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Ideas
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/vendors"
            aria-label="Search vendors"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'md:hidden')}
          >
            <Search aria-hidden="true" />
          </Link>

          {signedIn ? (
            <>
              <Link
                href="/account/shortlist"
                aria-label="Your shortlist"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
              >
                <Heart aria-hidden="true" />
                <span className="hidden sm:inline">Shortlist</span>
              </Link>
              <Link
                href="/account"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                <UserRound aria-hidden="true" />
                <span className="hidden sm:inline">Account</span>
              </Link>
              <SignOutButton className="hidden sm:inline-flex" label="" />
            </>
          ) : (
            <Link
              href="/auth/sign-in"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Sign in
            </Link>
          )}

          <Link
            href="/vendor/join"
            className={cn(buttonVariants({ size: 'sm' }), 'hidden sm:inline-flex')}
          >
            List your business
          </Link>
        </div>
      </div>
    </header>
  )
}
