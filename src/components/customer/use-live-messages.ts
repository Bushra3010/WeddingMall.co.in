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
 * refreshing on an interval. The thread stays correct either way; only the
 * latency changes.
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

    const timer = setInterval(() => router.refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [conversationId, connected, router])

  return { connected }
}
