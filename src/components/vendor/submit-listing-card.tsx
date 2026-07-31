'use client'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { submitListingAction } from '@/features/listings/actions'

const MIN_ABOUT = 50

/**
 * Submitting an edit for review. Deliberately explicit about what happens to
 * the currently published version — "submit" is otherwise easy to read as
 * "publish" (PRD 6.9).
 */
export function SubmitListingCard({
  vendorId,
  hasPending,
  hasPublished,
  aboutLength,
}: {
  vendorId: string
  hasPending: boolean
  hasPublished: boolean
  aboutLength: number
}) {
  const [state, action] = useAction(submitListingAction)
  const tooShort = aboutLength < MIN_ABOUT

  if (hasPending) {
    return (
      <p className="border-sand-200 text-sand-600 rounded-[var(--radius-card)] border bg-white p-5 text-sm">
        An edit is already awaiting review. You will be able to submit again once it is decided.
      </p>
    )
  }

  return (
    <form
      action={action}
      className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
    >
      <h2 className="font-display text-sand-900 text-lg">
        {hasPublished ? 'Submit your changes' : 'Publish your listing'}
      </h2>
      <input type="hidden" name="vendorId" value={vendorId} />
      <FormMessage state={state} successMessage="Sent for review." />

      {tooShort ? (
        <p className="bg-sand-50 text-sand-700 rounded-lg p-3 text-sm">
          Write at least {MIN_ABOUT} characters in the description first — currently {aboutLength}.
        </p>
      ) : (
        <p className="text-sand-600 text-sm">
          {hasPublished
            ? 'Your current listing stays live while we review the changes.'
            : 'Your listing goes live once approved.'}
        </p>
      )}

      <SubmitButton pendingLabel="Sending…">Send for review</SubmitButton>
    </form>
  )
}
