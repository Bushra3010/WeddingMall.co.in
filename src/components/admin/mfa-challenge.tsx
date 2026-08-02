'use client'

import { FormMessage, fieldError, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { verifyTotpAction } from '@/features/admin/mfa-actions'

/**
 * Re-verification for an existing factor (PRD 10.3).
 *
 * Reuses `verifyTotpAction` — the same code path that completes enrolment also
 * elevates a session, because to the auth server they are the same operation.
 * One implementation means one place for the rate limit and the uniform error.
 */
export function MfaChallenge({ factorId, reason }: { factorId: string; reason: string }) {
  const [state, action] = useAction(verifyTotpAction)

  return (
    <form action={action} className="max-w-sm space-y-4">
      <input type="hidden" name="factorId" value={factorId} />
      <p className="text-sand-600 text-sm">{reason}</p>

      <FormMessage state={state} successMessage="Verified. Continue below." />

      <Field label="Six-digit code" required error={fieldError(state, 'code')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            className="max-w-40 font-mono tracking-widest"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <SubmitButton pendingLabel="Checking…">Verify</SubmitButton>
    </form>
  )
}
