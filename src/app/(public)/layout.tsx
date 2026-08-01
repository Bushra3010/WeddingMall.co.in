import { SiteFooter } from '@/components/public/site-footer'
import { SiteHeader } from '@/components/public/site-header'
import { signOut } from '@/features/auth/actions'
import { getActor } from '@/server/dal/actor'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={Boolean(actor.userId)} signOutAction={signOut} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
