import { NextResponse, type NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { log, logError } from '@/lib/observability/logger'

/**
 * Nightly rollup into `vendor_metrics_daily` (PRD 6.9, 13).
 *
 * Recomputes yesterday and today rather than only yesterday: the current day
 * is still accumulating, and a missed run repairs itself on the next pass
 * because `rebuild_vendor_metrics` overwrites rather than increments.
 *
 * Uses the service-role client, which is allowed here — cron handlers are one
 * of the three places CLAUDE.md permits it.
 */
export const dynamic = 'force-dynamic'

function authorised(request: NextRequest): boolean {
  const header = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${serverEnv().CRON_SECRET}`

  // Constant-time-ish: compare lengths first so a mismatch in length does not
  // leak through early exit on the first differing byte.
  if (header.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < header.length; i += 1) {
    diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    // No detail: an unauthenticated caller learns only that it was refused.
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('rebuild_vendor_metrics', {
      p_from: yesterday,
      p_to: today,
    })

    if (error) throw error

    /*
     * Housekeeping rides along with the nightly job rather than getting its own
     * schedule: the rate-limit table only ever costs disk, so a missed prune is
     * harmless and a second cron entry is one more thing to configure and
     * forget.
     */
    const { data: pruned } = await supabase.rpc('prune_rate_limits', { p_older_than_hours: 24 })

    log.info('cron.vendorMetrics', { from: yesterday, to: today, rows: data, pruned })
    return NextResponse.json({ ok: true, from: yesterday, to: today, rows: data, pruned })
  } catch (error) {
    logError('cron.vendorMetrics', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
