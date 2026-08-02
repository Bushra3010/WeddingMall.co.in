'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { createClient } from '@/lib/supabase/client'

/**
 * Client-side session state for presentation only.
 *
 * ## Why this exists
 *
 * Reading the session on the server opts a route out of static rendering — for
 * every visitor, not just signed-in ones. The public layout did exactly that
 * to decide between "Sign in" and "Account", which made every public page a
 * function invocation on a distant server (ADR-030). Resolving it in the
 * browser instead lets those pages be served from the edge cache.
 *
 * ## This is NOT an authorisation signal
 *
 * `getSession()` reads the cookie without revalidating the JWT against the
 * auth server, so a tampered cookie could make `signedIn` true here. That is
 * deliberately harmless: nothing in this context decides what a user may do.
 * It picks which label a button shows. Every actual permission is enforced by
 * RLS and by `assertPermission` on the server, where a forged cookie fails.
 *
 * Never widen this to gate a capability. If a component needs to know who
 * someone really is, it needs a server round trip.
 */

interface SessionState {
  /** Presentation only — see the warning above. */
  signedIn: boolean
  /** False until the browser has looked; components render the signed-out
   *  affordance meanwhile, which is what most visitors will see anyway. */
  ready: boolean
  /** Vendor ids this user has saved, for rendering save controls. */
  shortlistedIds: ReadonlySet<string>
}

const EMPTY: ReadonlySet<string> = new Set()

const SessionContext = createContext<SessionState>({
  signedIn: false,
  ready: false,
  shortlistedIds: EMPTY,
})

export function useSession(): SessionState {
  return useContext(SessionContext)
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    signedIn: false,
    ready: false,
    shortlistedIds: EMPTY,
  })

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    /**
     * One query, and only for a signed-in visitor. RLS scopes `shortlists` to
     * the caller, so this cannot return anyone else's rows even though it runs
     * in the browser.
     */
    async function loadShortlist(signedIn: boolean) {
      if (!signedIn) return EMPTY
      const { data, error } = await supabase.from('shortlists').select('vendor_id')
      if (error) return EMPTY
      return new Set((data ?? []).map((row) => row.vendor_id))
    }

    async function sync(signedIn: boolean) {
      const shortlistedIds = await loadShortlist(signedIn)
      if (!cancelled) setState({ signedIn, ready: true, shortlistedIds })
    }

    // `getSession()` reads the cookie locally — no network round trip, so this
    // costs nothing for the signed-out majority.
    supabase.auth.getSession().then(({ data }) => void sync(Boolean(data.session)))

    /*
     * Re-check whenever the tab regains focus or the page is restored.
     *
     * Sign-out is a Server Action: it clears the auth cookie and redirects, but
     * the browser client is never told. Its in-memory session stayed valid, so
     * `signedIn` remained true and the header kept offering "Sign out" to
     * somebody who was already signed out. Reading the cookie again on
     * visibility change catches that, and also catches a sign-out performed in
     * another tab.
     */
    const recheck = () => {
      if (document.visibilityState !== 'visible') return
      void supabase.auth.getSession().then(({ data }) => void sync(Boolean(data.session)))
    }
    document.addEventListener('visibilitychange', recheck)
    window.addEventListener('pageshow', recheck)

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void sync(Boolean(session))
    })

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', recheck)
      window.removeEventListener('pageshow', recheck)
      subscription.subscription.unsubscribe()
    }
  }, [])

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
}
