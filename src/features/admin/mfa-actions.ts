'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import { audit } from '@/lib/security/audit'
import { getActor } from '@/server/dal/actor'
import { callerKey, enforceRateLimit } from '@/lib/security/rate-limit'

/** TOTP enrolment and challenge (PRD 10.3). */

const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the six-digit code from your authenticator app.')

export async function enrolTotpAction(): Promise<
  ActionResult<{ factorId: string; qr: string; secret: string }>
> {
  return runAction('admin.mfaEnrol', async () => {
    const actor = await getActor()
    if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

    const supabase = await createClient()

    /*
     * Clear any half-finished enrolment first. An `unverified` factor from an
     * abandoned attempt otherwise blocks a new one with a duplicate-name
     * error, and the person sees a failure for something they did right.
     */
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const factor of existing?.all ?? []) {
      if (factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id })
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    })

    if (error || !data) {
      throw new ServiceError('internal_error', error?.message ?? 'Could not start enrolment.')
    }

    return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
  })
}

export async function verifyTotpAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ verified: true }>> {
  const result = await runAction('admin.mfaVerify', async () => {
    const actor = await getActor()
    if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

    // A six-digit code is 10^6 guesses; without a limit that is minutes of
    // brute force. Keyed to the user, so one account's attempts cannot lock
    // out another's.
    await enforceRateLimit(
      { bucket: 'mfa', limit: 10, windowSeconds: 900 },
      await callerKey(actor.userId),
    )

    const factorId = String(form.get('factorId') ?? '')
    const code = codeSchema.parse(String(form.get('code') ?? ''))
    if (!factorId) throw new ServiceError('validation_error', 'Enrolment expired. Start again.')

    const supabase = await createClient()
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    })
    if (challengeError || !challenge) {
      throw new ServiceError('internal_error', 'Could not start the check. Try again.')
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })

    if (error) {
      // Same message whether the factor is wrong or the code is: a distinction
      // here tells an attacker which half they got right.
      throw new ServiceError(
        'forbidden',
        'That code was not accepted. Check the time on your device and try again.',
      )
    }

    void audit({
      action: 'role.change',
      entityType: 'mfa_factor',
      entityId: actor.userId,
      actorUserId: actor.userId,
      after: { event: 'verified' },
    })

    return { verified: true as const }
  })

  if (result.ok) {
    revalidatePath('/admin/security')
    revalidatePath('/admin')
  }
  return result
}

export async function unenrolTotpAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ removed: true }>> {
  const result = await runAction('admin.mfaUnenrol', async () => {
    const actor = await getActor()
    if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

    const factorId = String(form.get('factorId') ?? '')
    if (!factorId) throw new ServiceError('validation_error', 'Missing factor.')

    const supabase = await createClient()

    /*
     * Removing a factor is itself a privileged action, so it requires the
     * session to already be at aal2. Otherwise a stolen aal1 session could
     * strip the protection it is not able to satisfy.
     */
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel !== 'aal2') {
      throw new ServiceError('forbidden', 'Verify with your authenticator before removing it.')
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) throw new ServiceError('internal_error', 'Could not remove that authenticator.')

    void audit({
      action: 'role.change',
      entityType: 'mfa_factor',
      entityId: actor.userId,
      actorUserId: actor.userId,
      after: { event: 'removed' },
    })

    return { removed: true as const }
  })

  if (result.ok) revalidatePath('/admin/security')
  return result
}
