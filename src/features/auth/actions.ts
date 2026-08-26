'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { log } from '@/lib/observability/logger'
import {
  CURRENT_POLICY_VERSION,
  resetRequestSchema,
  safeRedirect,
  signInSchema,
  signUpSchema,
} from './schema'
import { autoConfirmUser } from '@/server/jobs/confirm-user'

/**
 * Auth server actions.
 *
 * Errors are deliberately non-enumerating: a wrong password and an unknown
 * account return the same message so the form cannot be used to discover which
 * addresses are registered.
 */

function formValue(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

export async function signIn(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  const result = await runAction('auth.signIn', async () => {
    const input = signInSchema.parse({
      email: formValue(form, 'email'),
      password: formValue(form, 'password'),
    })

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })

    if (error) {
      log.warn('auth.signIn.failed', { reason: error.message })
      throw new ServiceError('invalid_credentials', 'That email or password is not correct.')
    }

    return null
  })

  if (result.ok) {
    revalidatePath('/', 'layout')
    redirect(safeRedirect(formValue(form, 'next')))
  }

  return result
}

export async function signUp(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  const result = await runAction('auth.signUp', async () => {
    const input = signUpSchema.parse({
      fullName: formValue(form, 'fullName'),
      email: formValue(form, 'email'),
      password: formValue(form, 'password'),
      acceptTerms: form.get('acceptTerms') === 'on' || form.get('acceptTerms') === 'true',
      next: formValue(form, 'next') || undefined,
    })

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.fullName },
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(
          safeRedirect(input.next),
        )}`,
      },
    })

    if (error) {
      log.warn('auth.signUp.failed', { reason: error.message })
      throw new ServiceError(
        'signup_failed',
        'We could not create that account. Try signing in instead.',
      )
    }

    // Auto-confirm so the user can log in immediately without checking email.
    if (data.user?.id) {
      await autoConfirmUser(data.user.id)
    }

    // Consent is recorded against the policy version in force at sign-up.
    if (data.user) {
      const forwarded = (await headers()).get('x-forwarded-for')
      await supabase.from('user_consents').insert({
        user_id: data.user.id,
        consent_type: 'terms_and_privacy',
        policy_version: CURRENT_POLICY_VERSION,
        granted: true,
        source: forwarded ? 'web' : 'web',
      })
    }

    // When email confirmation is enabled, signUp doesn't return a session even
    // after we auto-confirm the user. Sign them in directly so they land on
    // the wizard without a manual login step.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })

    if (signInError) {
      /*
       * Surfaced rather than warned about. Returning success here sends the
       * caller to a protected route with no session, which bounces them back to
       * where they started looking like the sign-up silently failed. Telling
       * them to sign in is both true and actionable.
       */
      log.warn('auth.signUp.autoSignIn.failed', { reason: signInError.message, email: input.email })
      throw new ServiceError(
        'signin_required',
        'Your account was created. Please sign in to continue.',
      )
    }

    return null
  })

  if (result.ok) {
    revalidatePath('/', 'layout')
    redirect(safeRedirect(formValue(form, 'next')))
  }

  return result
}

export async function requestPasswordReset(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  return runAction('auth.requestPasswordReset', async () => {
    const input = resetRequestSchema.parse({ email: formValue(form, 'email') })
    const supabase = await createClient()

    await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/account/settings`,
    })

    // Always succeeds from the caller's point of view: revealing whether the
    // address exists would leak account membership.
    return null
  })
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
