'use client'

import { useEffect } from 'react'

import { createClient } from '@/lib/supabase/client'

/**
 * Records one profile view (PRD 6.9, 13).
 *
 * Deliberately a client effect rather than a write during render: a Server
 * Component render can be retried, prefetched, or discarded, and counting a
 * view for each of those would inflate the number a vendor is shown — and may
 * be paying attention to.
 *
 * `sessionStorage` keeps a refresh or a back-navigation from counting twice
 * within the same tab. It is not a defence against someone determined to
 * inflate their own numbers; the honest description of this metric is "page
 * loads by distinct tab", and `rebuild_vendor_metrics` counts exactly that.
 */
export function ViewBeacon({ vendorId }: { vendorId: string }) {
  useEffect(() => {
    const key = `vm:viewed:${vendorId}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')

    let sessionId = sessionStorage.getItem('vm:session')
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      sessionStorage.setItem('vm:session', sessionId)
    }

    // Fire and forget: a failed count must never surface to the visitor, and
    // the vendor's own view of their profile is as valid a page load as any.
    void createClient()
      .rpc('record_vendor_profile_view', { p_vendor_id: vendorId, p_session_id: sessionId })
      .then(() => undefined)
  }, [vendorId])

  return null
}
