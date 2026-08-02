import 'server-only'

import { headers } from 'next/headers'

import { createAdminClient } from '@/lib/supabase/admin'
import { ServiceError } from '@/lib/action-result'
import { logError } from '@/lib/observability/logger'

/**
 * Rate limiting (PRD 10.3).
 *
 * State lives in Postgres (migration `0025`) because serverless instances do
 * not share memory: an in-process counter would reset on every cold start and
 * hold a different count per instance.
 *
 * Uses the service-role client. The `rate_limits` table is deny-all to clients
 * on purpose — telling a caller how much quota they have left helps only
 * someone trying to stay just under it.
 */

export interface Limit {
  bucket: string
  limit: number
  windowSeconds: number
}

/** Tuned to be invisible to a person and obstructive to a script. */
export const LIMITS = {
  enquiry: { bucket: 'enquiry', limit: 10, windowSeconds: 3600 },
  message: { bucket: 'message', limit: 60, windowSeconds: 3600 },
  review: { bucket: 'review', limit: 5, windowSeconds: 86_400 },
  newsletter: { bucket: 'newsletter', limit: 5, windowSeconds: 3600 },
  checkout: { bucket: 'checkout', limit: 20, windowSeconds: 3600 },
} as const satisfies Record<string, Limit>

/**
 * Best-effort caller identity.
 *
 * A user id when signed in, otherwise the forwarded client IP. On Vercel the
 * left-most `x-forwarded-for` entry is the real client and the rest are
 * proxies; the header is attacker-controllable in general, which is why a user
 * id is preferred whenever there is one.
 */
export async function callerKey(userId?: string | null): Promise<string> {
  if (userId) return `user:${userId}`

  const store = await headers()
  const forwarded = store.get('x-forwarded-for') ?? ''
  const ip = forwarded.split(',')[0]?.trim() || store.get('x-real-ip') || ''
  return ip ? `ip:${ip}` : ''
}

/**
 * Throws `rate_limited` when the caller is over the ceiling.
 *
 * **Fails open on infrastructure error.** If the limiter itself is unreachable
 * the choice is between refusing every enquiry on the site and briefly
 * accepting unlimited ones. Losing real customers to a database blip is the
 * worse outcome, and the failure is logged so it does not pass unnoticed. A
 * limiter guarding something irreversible would want the opposite default.
 */
export async function enforceRateLimit(limit: Limit, subject: string): Promise<void> {
  if (!subject) {
    throw new ServiceError('rate_limited', 'Too many requests. Please try again shortly.')
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('consume_rate_limit', {
      p_bucket: limit.bucket,
      p_subject: subject,
      p_limit: limit.limit,
      p_window_seconds: limit.windowSeconds,
    })

    if (error) throw error

    if (data === false) {
      throw new ServiceError(
        'rate_limited',
        'That is more requests than we allow in a short period. Please try again later.',
      )
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error
    logError('security.rateLimit', error, { bucket: limit.bucket })
  }
}
