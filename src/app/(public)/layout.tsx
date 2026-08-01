import { BottomNav } from '@/components/public/bottom-nav'
import { SiteFooter } from '@/components/public/site-footer'
import { SiteHeader } from '@/components/public/site-header'
import { listCities } from '@/server/dal/taxonomy'

/**
 * Public shell.
 *
 * Deliberately reads no session. Doing so opted every public page out of
 * static rendering for every visitor — the whole tree became a function
 * invocation to decide whether the header says "Sign in" or "Account"
 * (ADR-030). The header and the bottom bar resolve that in the browser.
 *
 * `listCities` uses the cookie-free public client, so this stays cacheable.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const cities = await listCities(60)

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader cities={cities} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  )
}
