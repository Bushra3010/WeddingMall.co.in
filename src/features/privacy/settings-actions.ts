'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import { getActor } from '@/server/dal/actor'

/** Account profile and notification preferences (PRD 6.5, 6.12). */

const profileSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
})

export async function saveProfileAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const result = await runAction('account.saveProfile', async () => {
    const actor = await getActor()
    if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

    const input = profileSchema.parse({
      fullName: String(form.get('fullName') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
    })

    const supabase = await createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: input.fullName || null,
        phone: input.phone ?? null,
        /*
         * Changing the number clears its verified mark. Keeping the old flag
         * would let someone verify one number and then swap in another,
         * carrying the trust across to a number nobody checked.
         */
        phone_verified_at: null,
      })
      .eq('id', actor.userId)

    if (error) throw new ServiceError('internal_error', 'We could not save your details.')
    return { ok: true as const }
  })

  if (result.ok) revalidatePath('/account/settings')
  return result
}

/**
 * Notification preferences.
 *
 * Absence means "on": a row is written only when someone opts *out*, so a new
 * notification group reaches existing users by default rather than being
 * silently disabled for everyone who registered before it existed.
 */
export async function saveNotificationPrefsAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const result = await runAction('account.saveNotificationPrefs', async () => {
    const actor = await getActor()
    if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

    const groups = form.getAll('group').filter((v): v is string => typeof v === 'string')
    const supabase = await createClient()

    const rows = groups.map((group) => ({
      user_id: actor.userId!,
      channel: 'email' as const,
      notification_group: group,
      enabled: form.get(`enabled:${group}`) === 'on',
    }))

    if (rows.length === 0) return { ok: true as const }

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(rows, { onConflict: 'user_id,channel,notification_group' })

    if (error) throw new ServiceError('internal_error', 'We could not save your preferences.')
    return { ok: true as const }
  })

  if (result.ok) revalidatePath('/account/settings')
  return result
}
