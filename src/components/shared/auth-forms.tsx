'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { signIn, signUp } from '@/features/auth/actions'
import type { ActionResult } from '@/lib/action-result'

type State = ActionResult<null> | null

function FormError({ state }: { state: State }) {
  if (!state || state.ok) return null
  if (state.code === 'validation_error') return null
  return (
    <p
      role="alert"
      className="rounded-lg bg-[color-mix(in_oklch,var(--color-danger)_12%,white)] px-3 py-2 text-sm text-[var(--color-danger)]"
    >
      {state.message}
    </p>
  )
}

function fieldError(state: State, field: string): string | undefined {
  if (!state || state.ok) return undefined
  return state.fieldErrors?.[field]?.[0]
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState<State, FormData>(signIn, null)

  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ''} />

      <Field label="Email" error={fieldError(state, 'email')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Password" error={fieldError(state, 'password')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>

      <p className="text-sand-600 text-center text-sm">
        New here?{' '}
        <Link href="/auth/sign-up" className="text-brand-700 font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  )
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState<State, FormData>(signUp, null)

  if (state?.ok) {
    return (
      <div
        role="status"
        className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-6 text-center"
      >
        <h2 className="font-display text-sand-900 text-lg">Check your inbox</h2>
        <p className="text-sand-600 mt-2 text-sm">
          We have sent you a link to confirm your email address. Open it to finish setting up your
          account.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ''} />

      <Field label="Your name" error={fieldError(state, 'fullName')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="fullName"
            autoComplete="name"
            required
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Email" error={fieldError(state, 'email')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field
        label="Password"
        hint="At least 10 characters, including a letter and a number."
        error={fieldError(state, 'password')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <div className="space-y-1">
        <label className="text-sand-700 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="border-sand-400 mt-1 size-4 rounded"
          />
          <span>
            I accept the{' '}
            <Link href="/terms" className="text-brand-700 font-medium hover:underline">
              terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-brand-700 font-medium hover:underline">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {fieldError(state, 'acceptTerms') ? (
          <p role="alert" className="text-xs text-[var(--color-danger)]">
            {fieldError(state, 'acceptTerms')}
          </p>
        ) : null}
      </div>

      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>

      <p className="text-sand-600 text-center text-sm">
        Already have an account?{' '}
        <Link href="/auth/sign-in" className="text-brand-700 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
