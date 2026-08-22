import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/observability/logger'

/**
 * Auto-confirms a user so they can sign in immediately without email verification.
 *
 * This uses the admin client (service role) which is safe here because:
 * - This module is `server-only` — never bundled for the client
 * - The only caller is `src/features/auth/actions.ts` `signUp`
 * - It only marks the freshly-created user as confirmed; no privilege escalation
 */
export async function autoConfirmUser(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })
    if (error) {
      logError('auth.autoConfirm.failed', error, { userId })
      return false
    }
    return true
  } catch (error) {
    logError('auth.autoConfirm.threw', error, { userId })
    return false
  }
}
