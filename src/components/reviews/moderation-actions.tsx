'use client'

import { useFormStatus } from 'react-dom'

import { FormMessage, fieldError, useAction } from '@/components/shared/action-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { moderateReviewAction } from '@/features/reviews/actions'

/**
 * Approve, reject, or flag a review (PRD 6.8, 6.11).
 *
 * Each button carries its own `name="decision"` and value — the standard way a
 * form says "same data, different intent", and it works without JavaScript.
 * A shared hidden default was the alternative and was rejected: with both a
 * hidden field and a submitter present, which value wins depends on DOM order,
 * which is exactly the kind of thing that survives review and then breaks when
 * someone reorders the markup.
 *
 * Requiring a reason for reject/flag lives in the Zod schema, not in disabled
 * buttons, so it also holds for a request that never rendered this form.
 */
function Decision({
  value,
  variant,
  children,
}: {
  value: 'approved' | 'rejected' | 'flagged'
  variant: 'primary' | 'outline'
  children: React.ReactNode
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      name="decision"
      value={value}
      variant={variant}
      disabled={pending}
      aria-busy={pending}
    >
      {children}
    </Button>
  )
}

export function ModerationActions({
  reviewId,
  vendorSlug,
}: {
  reviewId: string
  vendorSlug?: string
}) {
  const [state, action] = useAction(moderateReviewAction)

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      {vendorSlug ? <input type="hidden" name="vendorSlug" value={vendorSlug} /> : null}
      <FormMessage state={state} />

      <label className="sr-only" htmlFor={`reason-${reviewId}`}>
        Reason — required to reject or flag
      </label>
      <Input
        id={`reason-${reviewId}`}
        name="reason"
        placeholder="Reason — required to reject or flag"
        maxLength={500}
        invalid={Boolean(fieldError(state, 'reason'))}
      />
      {fieldError(state, 'reason') ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {fieldError(state, 'reason')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Decision value="approved" variant="primary">
          Approve
        </Decision>
        <Decision value="rejected" variant="outline">
          Reject
        </Decision>
        <Decision value="flagged" variant="outline">
          Flag
        </Decision>
      </div>
    </form>
  )
}
