'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck } from 'lucide-react'

import { FormMessage, fieldError, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { enrolTotpAction, unenrolTotpAction, verifyTotpAction } from '@/features/admin/mfa-actions'

/**
 * TOTP enrolment and verification (PRD 10.3).
 *
 * The secret is shown as text beside the QR code, not only as an image — an
 * administrator setting this up on the same device they are reading it on
 * cannot photograph their own screen, and a screen reader cannot use a QR
 * code at all.
 */
export function MfaSetup({
  enrolled,
}: {
  enrolled: { id: string; friendlyName: string | null }[]
}) {
  const [pending, startTransition] = useTransition()
  const [enrolment, setEnrolment] = useState<{
    factorId: string
    qr: string
    secret: string
  } | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [verifyState, verifyAction] = useAction(verifyTotpAction)
  const [removeState, removeAction] = useAction(unenrolTotpAction)

  function start() {
    setStartError(null)
    startTransition(async () => {
      const result = await enrolTotpAction()
      if (result.ok) setEnrolment(result.data)
      else setStartError(result.message)
    })
  }

  if (enrolled.length > 0 && !enrolment) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm text-[var(--color-success)]">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Two-factor authentication is on for this account.
        </p>
        <ul className="divide-sand-100 divide-y">
          {enrolled.map((factor) => (
            <li key={factor.id} className="flex items-center justify-between gap-3 py-3">
              <span className="text-sand-800 text-sm">
                {factor.friendlyName ?? 'Authenticator app'}
              </span>
              <form action={removeAction}>
                <input type="hidden" name="factorId" value={factor.id} />
                <button
                  type="submit"
                  className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-3 py-1 text-xs font-medium"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
        <FormMessage state={removeState} />
      </div>
    )
  }

  if (!enrolment) {
    return (
      <div className="space-y-3">
        <p className="text-sand-600 text-sm">
          You will need an authenticator app such as Google Authenticator, 1Password, or Authy.
        </p>
        {startError ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {startError}
          </p>
        ) : null}
        <Button type="button" onClick={start} disabled={pending} aria-busy={pending}>
          {pending ? 'Preparing…' : 'Set up two-factor authentication'}
        </Button>
      </div>
    )
  }

  return (
    <form action={verifyAction} className="space-y-4">
      <input type="hidden" name="factorId" value={enrolment.factorId} />

      <ol className="text-sand-700 list-decimal space-y-2 pl-5 text-sm">
        <li>Scan this code with your authenticator app.</li>
        <li>Enter the six-digit code it shows.</li>
      </ol>

      <div className="border-sand-200 inline-block rounded-[var(--radius-card)] border bg-white p-3">
        {/*
          A plain <img>, not next/image. Supabase returns the QR as an
          `image/svg+xml` data URI, which next/image rejects outright — it
          threw and took the whole page down with it, so the only route that
          can enrol a factor became unusable. There is nothing to optimise
          about a data URI anyway.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enrolment.qr}
          alt="QR code for enrolling your authenticator app"
          width={180}
          height={180}
        />
      </div>

      <div>
        <p className="text-sand-600 text-xs">Cannot scan it? Enter this key by hand:</p>
        <code className="text-sand-900 mt-1 block font-mono text-sm break-all">
          {enrolment.secret}
        </code>
      </div>

      <FormMessage state={verifyState} successMessage="Two-factor authentication is now on." />

      <Field label="Six-digit code" required error={fieldError(verifyState, 'code')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            className="max-w-40 font-mono tracking-widest"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <SubmitButton pendingLabel="Checking…">Turn on two-factor</SubmitButton>
    </form>
  )
}
