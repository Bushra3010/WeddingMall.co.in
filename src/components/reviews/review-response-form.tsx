'use client'

import { FormMessage, fieldError, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Textarea } from '@/components/ui/field'
import { respondToReviewAction } from '@/features/reviews/actions'

/**
 * A vendor's single public reply to a review (PRD 6.8).
 *
 * One reply per review is a database constraint, so this is an upsert rather
 * than an append — editing the reply replaces it, and the form is the same
 * whether one exists yet or not.
 *
 * The reply is itself moderated, so it does not appear on the profile the
 * moment it is written. Saying so here avoids a vendor reposting because they
 * cannot see their own words on the public page.
 */
export function ReviewResponseForm({
  reviewId,
  existing,
}: {
  reviewId: string
  existing?: { body: string; status: string } | null
}) {
  const [state, action] = useAction(respondToReviewAction)

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <FormMessage state={state} successMessage="Saved. Your reply appears once approved." />

      <Field
        label={existing ? 'Your public reply' : 'Reply publicly'}
        hint={
          existing?.status === 'pending'
            ? 'Your previous reply is still awaiting moderation.'
            : 'Visible on your public profile once a moderator approves it.'
        }
        error={fieldError(state, 'body')}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="body"
            required
            minLength={10}
            maxLength={2000}
            defaultValue={existing?.body ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <SubmitButton pendingLabel="Saving…">{existing ? 'Update reply' : 'Post reply'}</SubmitButton>
    </form>
  )
}
