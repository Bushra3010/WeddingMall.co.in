'use client'

import { useState } from 'react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Textarea } from '@/components/ui/field'
import { decideVendorAction } from '@/features/vendors/actions'
import type { AdminDecision } from '@/features/vendors/schema'

const OPTIONS: { value: AdminDecision; label: string; needsReason: boolean; tone: string }[] = [
  {
    value: 'approve',
    label: 'Approve and publish',
    needsReason: false,
    tone: 'text-[var(--color-success)]',
  },
  { value: 'request_changes', label: 'Request changes', needsReason: true, tone: 'text-sand-800' },
  { value: 'reject', label: 'Reject', needsReason: true, tone: 'text-[var(--color-danger)]' },
]

const SUSPENSION: { value: AdminDecision; label: string }[] = [
  { value: 'suspend', label: 'Suspend' },
  { value: 'reactivate', label: 'Reactivate' },
]

/**
 * Moderation decision (PRD 6.11, Epic E — every action requires a reason where
 * specified). The reason field becomes required the moment a decision that
 * needs one is selected; the server and the SQL both re-check.
 */
export function DecisionForm({
  vendorId,
  status,
  canVerify,
  canSuspend,
}: {
  vendorId: string
  status: string
  canVerify: boolean
  canSuspend: boolean
}) {
  const [state, action] = useAction(decideVendorAction)
  const [decision, setDecision] = useState<AdminDecision>('approve')

  const available = [
    ...(canVerify && status !== 'suspended' ? OPTIONS : []),
    ...(canSuspend
      ? SUSPENSION.filter((option) =>
          option.value === 'suspend' ? status === 'active' : status === 'suspended',
        ).map((option) => ({
          ...option,
          needsReason: option.value === 'suspend',
          tone: 'text-sand-800',
        }))
      : []),
  ]

  if (available.length === 0) {
    return (
      <p className="border-sand-300 bg-sand-50 text-sand-700 rounded-lg border p-3 text-sm">
        You do not have permission to make a decision on this business.
      </p>
    )
  }

  const needsReason = available.find((option) => option.value === decision)?.needsReason ?? true

  return (
    <form
      action={action}
      className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
    >
      <h2 className="font-display text-sand-900 text-lg">Decision</h2>
      <input type="hidden" name="vendorId" value={vendorId} />
      <FormMessage state={state} successMessage="Decision recorded." />

      <fieldset>
        <legend className="text-sand-800 text-sm font-medium">Choose an outcome</legend>
        <div className="mt-2 space-y-2">
          {available.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="decision"
                value={option.value}
                checked={decision === option.value}
                onChange={() => setDecision(option.value)}
                className="size-4"
              />
              <span className={option.tone}>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Reason"
        hint={
          needsReason
            ? 'Shared with the vendor so they know what to fix. Recorded in the audit log.'
            : 'Optional for an approval.'
        }
        error={fieldError(state, 'reason')}
        required={needsReason}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="reason"
            required={needsReason}
            maxLength={1000}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <SubmitButton pendingLabel="Recording…">Record decision</SubmitButton>
    </form>
  )
}
