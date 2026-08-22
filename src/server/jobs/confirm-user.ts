import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { log, logError } from '@/lib/observability/logger'

/**
 * Auto-confirms a user so they can sign in immediately without email verification.
 *
 * Supabase can return a user ID from signUp before the record is queryable via
 * the admin API, so we back off and retry a few times before giving up.
 */
export async function autoConfirmUser(userId: string): Promise<boolean> {
  const admin = createAdminClient()

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const { data, error } = await admin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      })

      if (!error) {
        const confirmed = data?.user?.email_confirmed_at != null
        log.info('auth.autoConfirm.success', { userId, confirmed, attempt })
        return confirmed
      }

      // Retry on "not found" — the auth record may still be replicating.
      if (error.message?.toLowerCase().includes('not found') && attempt < 5) {
        const backoff = attempt * 300
        log.warn('auth.autoConfirm.retry', { userId, attempt, backoff })
        await new Promise((resolve) => setTimeout(resolve, backoff))
        continue
      }

      logError('auth.autoConfirm.failed', error, { userId, message: error.message, attempt })
      return false
    } catch (error) {
      logError('auth.autoConfirm.threw', error, { userId, attempt })
      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 300))
        continue
      }
      return false
    }
  }

  return false
}
