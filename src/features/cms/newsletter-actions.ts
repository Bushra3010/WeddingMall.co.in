'use server'

import { z } from 'zod'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import { LIMITS, callerKey, enforceRateLimit } from '@/lib/security/rate-limit'
import { getActor } from '@/server/dal/actor'

const schema = z.object({
  email: z.email('Enter a valid email address').max(254).toLowerCase().trim(),
})

/**
 * Newsletter signup (PRD 6.12).
 *
 * Marketing consent is recorded explicitly and separately from transactional
 * contact. An address already on the list is treated as success rather than an
 * error — telling a stranger "that address is already subscribed" leaks
 * whether someone is a member.
 */
export async function subscribeAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  return runAction('cms.subscribe', async () => {
    const value = form.get('email')
    const { email } = schema.parse({ email: typeof value === 'string' ? value : '' })

    const actor = await getActor()

    /*
     * Anonymous and unauthenticated, so the subject is the client IP. This is
     * the one public write path on the site and the obvious target for a
     * signup flood (PRD 10.3).
     */
    await enforceRateLimit(LIMITS.newsletter, await callerKey(actor.userId))

    const supabase = await createClient()

    const { error } = await supabase.from('newsletter_subscribers').insert({
      email,
      user_id: actor.userId,
      source: 'footer',
      consented: true,
    })

    if (error && error.code !== '23505') {
      throw new ServiceError('internal_error', 'We could not sign you up. Please try again.')
    }

    return { ok: true }
  })
}
