import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { log, logError } from '@/lib/observability/logger'

/**
 * Auto-confirms a user so they can sign in immediately without email verification.
 */
export async function autoConfirmUser(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    log.info('auth.autoConfirm.attempt', { userId })

    // Use confirmed_at to bypass email confirmation
    const { data, error } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      confirmed_at: new Date().toISOString(),
    })

    if (error) {
      logError('auth.autoConfirm.failed', error, { userId, message: error.message })
      return false
    }

    const confirmed = data?.email_confirmed_at != null || data?.confirmed_at != null
    log.info('auth.autoConfirm.success', { userId, confirmed })
    return confirmed
  } catch (error) {
    logError('auth.autoConfirm.threw', error, { userId })
    return false
  }
}
