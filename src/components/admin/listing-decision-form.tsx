'use client'

import { useState } from 'react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Textarea } from '@/components/ui/field'
import { moderateListingAction } from '@/features/listings/actions'
import { type ListingDecision } from '@/features/listings/schema'

const OPTIONS: { value: ListingDecision; label: string; needsReason: boolean; tone: string }[] = [
  {
    value: 'approve',
    label: 'Approve and publish',
    needsReason: false,
    tone: 'text-[var(--color-success)]',
  },
  { value: 'request_changes', label: 'Request changes', needsReason: true, tone: 'text-sand-800' },
  {
    value: 'reject',
    label: 'Reject this version',
    needsReason: true,
    tone: 'text-[var(--color-danger)]',
  },
]

export function ListingDecisionForm({
  versionId,
  isFirstPublication,
}: {
  versionId: string
  isFirstPublication: boolean
}) {
  const [state, action] = useAction(moderateListingAction)
  const [decision, setDecision] = useState<ListingDecision>('approve')

  const needsReason = OPTIONS.find((o) => o.value === decision)?.needsReason ?? true

  return (
    <form
      action={action}
      className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
    >
      <h2 className="font-display text-sand-900 text-lg">Decision</h2>
      <input type="hidden" name="versionId" value={versionId} />
      <FormMessage state={state} successMessage="Decision recorded." />

      <fieldset>
        <legend className="text-sand-800 text-sm font-medium">Choose an outcome</legend>
        <div className="mt-2 space-y-2">
          {OPTIONS.map((option) => (
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
            ? 'Shown to the vendor so they know what to fix. Recorded in the audit log.'
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

      {!isFirstPublication && decision !== 'approve' ? (
        <p className="bg-sand-50 text-sand-600 rounded-lg p-3 text-xs">
          The currently published version stays live. Only this proposed edit is turned down.
        </p>
      ) : null}

      <SubmitButton pendingLabel="Recording…">Record decision</SubmitButton>
    </form>
  )
}
