'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import { audit } from '@/lib/security/audit'
import { getActor } from '@/server/dal/actor'

/**
 * Data subject requests (PRD 14.3).
 *
 * Deliberately a *request*, not an immediate action. A deletion that fired on
 * click would remove enquiry history a vendor may need for a live booking and
 * that we may be required to retain — so this records the ask, and an operator
 * completes it. The status is visible to the person who asked, so "we filed it
 * and forgot" is not an option that looks the same as success.
 */
const schema = z.object({
  type: z.enum(['export', 'deletion']),
  notes: z.string().trim().max(1000).optional(),
})

export async function createDataRequestAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ type: string }>> {
  const result = await runAction('privacy.request', async () => {
    const actor = await getActor()
    if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

    const input = schema.parse({
      type: String(form.get('type') ?? ''),
      notes: String(form.get('notes') ?? '').trim() || undefined,
    })

    const supabase = await createClient()

    // One open request of each kind. Without this, a frustrated person clicking
    // twice creates a queue an operator has to reconcile by hand.
    const { data: existing } = await supabase
      .from('data_requests')
      .select('id')
      .eq('user_id', actor.userId)
      .eq('type', input.type)
      .in('status', ['requested', 'processing'])
      .maybeSingle()

    if (existing) {
      // "an export" / "a deletion" — the article has to follow the noun.
      const article = input.type === 'export' ? 'an' : 'a'
      throw new ServiceError(
        'conflict',
        `You already have ${article} ${input.type} request in progress. We will let you know when it is done.`,
      )
    }

    const { error } = await supabase.from('data_requests').insert({
      user_id: actor.userId,
      type: input.type,
      notes: input.notes ?? null,
    })

    if (error) throw new ServiceError('internal_error', 'We could not record that request.')

    void audit({
      action: 'data.export',
      entityType: 'data_request',
      actorUserId: actor.userId,
      actorType: 'customer',
      after: { type: input.type },
    })

    return { type: input.type }
  })

  if (result.ok) revalidatePath('/account/privacy')
  return result
}
