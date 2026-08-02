import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'

/**
 * Admin multi-factor authentication and privileged session age (PRD 10.3).
 *
 * ## The lockout problem, and how this avoids it
 *
 * Requiring a second factor to reach `/admin` locks out an administrator who
 * has not enrolled one — including the only administrator, on the day the rule
 * ships. So enforcement is staged rather than absolute:
 *
 *   * **No factor enrolled** — every admin route redirects to `/admin/security`,
 *     which is reachable at aal1. The path out is enrolment, not a support
 *     ticket.
 *   * **Factor enrolled, session at aal1** — redirected to the challenge.
 *   * **Factor enrolled, session at aal2** — allowed, until it goes stale.
 *
 * `/admin/security` must never require aal2 itself, or the only route that can
 * fix the situation becomes unreachable. That is asserted in the E2E test.
 */

/** How long an elevated session stays privileged before re-verification. */
export const PRIVILEGED_SESSION_MINUTES = 30

export type MfaState =
  | { status: 'ok'; elevatedAt: Date | null }
  | { status: 'enrol' }
  | { status: 'challenge' }
  | { status: 'stale'; elevatedAt: Date }

interface AmrEntry {
  method: string
  timestamp: number
}

/**
 * When the current session last completed a second factor.
 *
 * Read from the `amr` claim rather than tracked separately: it is signed by
 * the auth server, so it cannot be extended by anything running in the
 * browser. Returns null when the session never reached aal2.
 */
function elevatedAt(accessToken: string): Date | null {
  try {
    const [, payload] = accessToken.split('.')
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString()) as {
      amr?: AmrEntry[]
    }
    const factor = (claims.amr ?? [])
      .filter((entry) => entry.method === 'totp' || entry.method === 'mfa/totp')
      .sort((a, b) => b.timestamp - a.timestamp)[0]

    return factor ? new Date(factor.timestamp * 1000) : null
  } catch {
    return null
  }
}

export async function getMfaState(): Promise<MfaState> {
  try {
    const supabase = await createClient()

    const [{ data: aal }, { data: factors }, { data: sessionData }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
      supabase.auth.getSession(),
    ])

    const verified = (factors?.totp ?? []).filter((factor) => factor.status === 'verified')
    if (verified.length === 0) return { status: 'enrol' }

    if (aal?.currentLevel !== 'aal2') return { status: 'challenge' }

    const token = sessionData.session?.access_token
    const at = token ? elevatedAt(token) : null
    if (!at) return { status: 'ok', elevatedAt: null }

    const ageMinutes = (Date.now() - at.getTime()) / 60_000
    if (ageMinutes > PRIVILEGED_SESSION_MINUTES) return { status: 'stale', elevatedAt: at }

    return { status: 'ok', elevatedAt: at }
  } catch (error) {
    /*
     * Fails OPEN, deliberately, and only for this check.
     *
     * The alternative is that an auth-service blip locks every administrator
     * out of moderation while the marketplace keeps running. Authorisation is
     * unaffected — `requireAdmin` and RLS still decide what an admin may do;
     * this only decides whether they are asked for a second factor.
     */
    logError('security.mfaState', error)
    return { status: 'ok', elevatedAt: null }
  }
}
