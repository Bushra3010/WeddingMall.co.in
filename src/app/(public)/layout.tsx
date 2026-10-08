import { BottomNav } from '@/components/public/bottom-nav'
import { SiteFooter } from '@/components/public/site-footer'
import { SiteHeader } from '@/components/public/site-header'

/**
 * Public shell.
 *
 * `SiteHeader` resolves `signedIn` itself from `SessionProvider` in the
 * browser (ADR-030), so this layout reads nothing session-specific and stays
 * static. It previously read the session server-side to pass `signedIn` /
 * `signOutAction` as props, which opted every public route — signed in or
 * not — out of static rendering and into a function invocation per request.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  )
}
