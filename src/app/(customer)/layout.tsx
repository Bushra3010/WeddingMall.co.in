import { BottomNav } from '@/components/public/bottom-nav'
import { DashboardNav } from '@/components/shared/dashboard-nav'
import { SiteHeader } from '@/components/public/site-header'
import { signOut } from '@/features/auth/actions'
import { getActor } from '@/server/dal/actor'
import { requireUser } from '@/server/policies/require'
import { NOINDEX } from '@/lib/seo'

export const metadata = NOINDEX
export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/account', label: 'Overview' },
  { href: '/account/wedding', label: 'Wedding profile' },
  { href: '/account/shortlist', label: 'Shortlist' },
  { href: '/account/enquiries', label: 'Enquiries' },
  { href: '/account/reviews', label: 'Reviews' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/account/settings', label: 'Settings' },
  { href: '/account/privacy', label: 'Privacy' },
]

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/account')
  const actor = await getActor()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={Boolean(actor.userId)} signOutAction={signOut} />
      <div className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_1fr] lg:content-normal">
        <DashboardNav items={NAV} label="Account" rootHref="/account" sticky="lg:top-24" />
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
      {/*
        The account area gets the same bar as the public site. "Shortlist"
        points into these routes, so dropping the bar on arrival would strand
        someone one tap into their account with no way back but the browser.
      */}
      <BottomNav />
    </div>
  )
}
