'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

/**
 * Live updates for a message thread (PRD 6.7).
 *
 * Subscribes to inserts on `messages` and refreshes the server component when
 * one arrives. It deliberately does not append the row itself: the payload is
 * the raw database row, and the thread renders sender names resolved through a
 * join. Trusting the payload would mean a second, thinner rendering path that
 * drifts from the real one — `router.refresh()` re-runs the query that already
 * knows how to render a message.
 *
 * Realtime evaluates RLS before delivering, so a subscriber who is not a
 * participant receives nothing. That is asserted in
 * `scripts/rls-realtime-probe.mjs` in both directions, because "the outsider
 * got nothing" also passes when the feed is simply broken.
 *
 * **Polling fallback.** If the socket never connects — a proxy blocking
 * WebSockets, the feature disabled, a transient failure — it falls back to
 * polling. The thread stays correct either way; only the latency changes.
 *
 * The poll asks Supabase directly for the newest message id (one tiny RLS-
 * filtered select, no server function involved) and only calls
 * `router.refresh()` when that id changes. The earlier version refreshed the
 * whole Server Component every 20 s whether or not anything had happened:
 * each refresh was a full Vercel function render with four Supabase queries,
 * it kept going in background tabs, and one open inbox tab alone burned about
 * 15 CPU-minutes a day — which is how two Hobby accounts hit the fair-use cap
 * in a fortnight. Hidden tabs do not poll at all and check once on return.
 */
const POLL_MS = 20_000

export function useLiveMessages(conversationId: string | null, enabled: boolean) {
  const router = useRouter()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled || !conversationId) return

    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    /*
     * The session has to be in hand BEFORE subscribing.
     *
     * The socket authenticates with whatever token realtime holds at connect
     * time. Subscribing during the first render connects as anonymous, RLS
     * then filters out every row, and the channel reports SUBSCRIBED while
     * delivering nothing — which is indistinguishable from a quiet thread.
     * That is exactly how this failed the first time it was wired up.
     */
    async function connect() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (cancelled || !session) return
      await supabase.realtime.setAuth(session.access_token)
      if (cancelled) return

      channel = supabase
        .channel(`thread:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            // Server-side filter as well as the RLS check — no reason to
            // receive other threads' rows and discard them on the client.
            filter: `conversation_id=eq.${conversationId}`,
          },
          () => {
            if (!cancelled) router.refresh()
          },
        )
        .subscribe((status) => {
          if (!cancelled) setConnected(status === 'SUBSCRIBED')
        })
    }

    void connect()

    return () => {
      cancelled = true
      setConnected(false)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [conversationId, enabled, router])

  useEffect(() => {
    // Only polls while the socket is not carrying updates, so the common case
    // costs nothing.
    if (!conversationId || connected) return

    const supabase = createClient()
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    // `undefined` until the first sample: the baseline must never trigger a
    // refresh, and a thread with no messages yet has a legitimate `null`.
    let seen: string | null | undefined

    const schedule = () => {
      if (cancelled) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void check(), POLL_MS)
    }

    async function check() {
      if (cancelled) return
      if (document.visibilityState !== 'visible') return

      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return

      if (!error) {
        const latest = data?.id ?? null
        if (seen !== undefined && latest !== seen) router.refresh()
        seen = latest
      }
      schedule()
    }

    // A tab coming back from the background checks immediately, then
    // resumes the cadence; one going hidden simply stops.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check()
      else if (timer) clearTimeout(timer)
    }
    document.addEventListener('visibilitychange', onVisibility)

    void check()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [conversationId, connected, router])

  return { connected }
}
