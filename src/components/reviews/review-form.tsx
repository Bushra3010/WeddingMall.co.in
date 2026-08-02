'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

import { FormMessage, fieldError, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { createReviewAction, updateReviewAction } from '@/features/reviews/actions'
import { cn } from '@/lib/utils'

/**
 * Write or edit a review (PRD 6.8).
 *
 * The star control is a radio group rather than a row of buttons: it is one
 * choice out of five, so arrow keys work with no code, it submits without
 * client JavaScript, and screen readers announce it as the single question it
 * is. The stars are a visual layer over real inputs.
 */
function StarRating({ name, defaultValue }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue ?? 0)

  return (
    <fieldset className="mt-1.5">
      <legend className="sr-only">Overall rating out of five</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className="cursor-pointer p-0.5">
            <input
              type="radio"
              name={name}
              value={star}
              required
              defaultChecked={defaultValue === star}
              onChange={() => setValue(star)}
              className="peer sr-only"
            />
            <Star
              aria-hidden="true"
              className={cn(
                'size-7 transition-transform hover:scale-110',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-brand-500)]',
                star <= value ? 'fill-gold-500 text-gold-500' : 'text-sand-300',
              )}
            />
            <span className="sr-only">
              {star} star{star === 1 ? '' : 's'}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function ReviewForm({ enquiryId, vendorName }: { enquiryId: string; vendorName: string }) {
  const [state, action] = useAction(createReviewAction)

  if (state?.ok) {
    return (
      <p
        role="status"
        className="rounded-lg bg-[color-mix(in_oklch,var(--color-success)_12%,white)] px-3 py-2 text-sm text-[var(--color-success)]"
      >
        Thank you — your review is with our moderators and appears once approved.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <FormMessage state={state} />

      <div>
        <span className="text-sand-800 block text-sm font-medium">
          How was your experience with {vendorName}?
        </span>
        <StarRating name="overallRating" />
        {fieldError(state, 'overallRating') ? (
          <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
            {fieldError(state, 'overallRating')}
          </p>
        ) : null}
      </div>

      <Field label="Title" error={fieldError(state, 'title')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="title"
            maxLength={120}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field
        label="Your review"
        required
        hint="What went well, and what should other couples know?"
        error={fieldError(state, 'body')}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="body"
            required
            minLength={20}
            maxLength={4000}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Event date" error={fieldError(state, 'eventDate')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="eventDate"
            type="date"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <SubmitButton pendingLabel="Sending…">Submit review</SubmitButton>
      <p className="text-sand-500 text-xs">
        Reviews are moderated before they appear, and only couples who enquired can leave one.
      </p>
    </form>
  )
}

export function ReviewEditForm({
  reviewId,
  vendorSlug,
  defaults,
}: {
  reviewId: string
  vendorSlug: string
  defaults: {
    overallRating: number
    title: string | null
    body: string | null
    eventDate: string | null
  }
}) {
  const [state, action] = useAction(updateReviewAction)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="vendorSlug" value={vendorSlug} />
      <FormMessage state={state} />

      {state?.ok ? (
        <p
          role="status"
          className="text-sand-800 rounded-lg bg-[color-mix(in_oklch,var(--color-warning)_18%,white)] px-3 py-2 text-sm"
        >
          Saved. Because the text changed, this review has returned to moderation and is hidden from
          the public profile until it is approved again.
        </p>
      ) : null}

      <div>
        <span className="text-sand-800 block text-sm font-medium">Rating</span>
        <StarRating name="overallRating" defaultValue={defaults.overallRating} />
      </div>

      <Field label="Title" error={fieldError(state, 'title')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="title"
            defaultValue={defaults.title ?? ''}
            maxLength={120}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Your review" required error={fieldError(state, 'body')}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="body"
            required
            defaultValue={defaults.body ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Event date" error={fieldError(state, 'eventDate')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="eventDate"
            type="date"
            defaultValue={defaults.eventDate ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  )
}
