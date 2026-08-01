'use client'

import { useState } from 'react'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Textarea } from '@/components/ui/field'
import { transitionEnquiryAction } from '@/features/enquiries/actions'
import {
  allowedTransitions,
  checkTransition,
  ENQUIRY_STATUS_LABELS,
  type EnquiryStatus,
  type TransitionActor,
} from '@/features/enquiries/status'

/**
 * Status changes available to this participant (PRD 6.6).
 *
 * The options come from the shared transition map, so the UI can never offer a
 * move the server would reject. The database trigger remains the boundary.
 */
export function EnquiryActions({
  enquiryId,
  status,
  actorType,
}: {
  enquiryId: string
  status: EnquiryStatus
  actorType: TransitionActor
}) {
  const [state, action] = useAction(transitionEnquiryAction)
  const options = allowedTransitions(status, actorType)
  const [selected, setSelected] = useState<EnquiryStatus | ''>('')

  if (options.length === 0) {
    return (
      <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
        <h2 className="text-sand-900 font-medium">Status</h2>
        <p className="text-sand-600 mt-1 text-sm">{ENQUIRY_STATUS_LABELS[status]}</p>
        <p className="text-sand-500 mt-2 text-xs">No changes are available from here.</p>
      </div>
    )
  }

  const needsReason = selected ? checkTransition(status, selected, actorType).requiresReason : false

  return (
    <form
      action={action}
      className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
    >
      <div>
        <h2 className="text-sand-900 font-medium">Status</h2>
        <p className="text-sand-600 mt-0.5 text-sm">{ENQUIRY_STATUS_LABELS[status]}</p>
      </div>

      <input type="hidden" name="enquiryId" value={enquiryId} />
      <FormMessage state={state} successMessage="Updated." />

      <Field label="Change to">
        {({ id }) => (
          <select
            id={id}
            name="status"
            value={selected}
            onChange={(event) => setSelected(event.target.value as EnquiryStatus)}
            required
            className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">Choose…</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {ENQUIRY_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        )}
      </Field>

      {needsReason ? (
        <Field label="Reason" hint="Shared with the other side." required>
          {({ id }) => <Textarea id={id} name="reason" required maxLength={500} rows={2} />}
        </Field>
      ) : null}

      <SubmitButton pendingLabel="Updating…">Update status</SubmitButton>
    </form>
  )
}
