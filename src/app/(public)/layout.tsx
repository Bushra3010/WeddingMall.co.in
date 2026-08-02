import { BottomNav } from '@/components/public/bottom-nav'
import { SiteFooter } from '@/components/public/site-footer'
import { SiteHeader } from '@/components/public/site-header'
import { signOut } from '@/features/auth/actions'
import { getActor } from '@/server/dal/actor'

/**
 * Public shell.
 *
 * Reads the session because the header takes `signedIn` and `signOutAction` as
 * props again (the navbar was reverted to its pre-Milestone-5 form at the
 * owner's request). That opts every public route out of static rendering —
 * measured at the time as static routes falling from 12 to 2 and TTFB rising
 * from ~0.15s to ~0.95s (ADR-030). Recorded rather than hidden: the trade was
 * asked for, and this is where the cost lands.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={Boolean(actor.userId)} signOutAction={signOut} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  )
}
