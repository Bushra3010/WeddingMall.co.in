import { BottomNav } from '@/components/public/bottom-nav'
import { SiteFooter } from '@/components/public/site-footer'
import { SiteHeader } from '@/components/public/site-header'
import { signOut } from '@/features/auth/actions'
import { getActor } from '@/server/dal/actor'
import { listCities } from '@/server/dal/taxonomy'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [actor, cities] = await Promise.all([getActor(), listCities(60)])

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={Boolean(actor.userId)} cities={cities} signOutAction={signOut} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <BottomNav signedIn={Boolean(actor.userId)} signOutAction={signOut} />
    </div>
  )
}
