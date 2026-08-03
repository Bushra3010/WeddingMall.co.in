'use client'

import { Mail } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { subscribeAction } from '@/features/cms/newsletter-actions'

export function NewsletterForm() {
  const [state, action] = useAction(subscribeAction)

  if (state?.ok) {
    return (
      <p role="status" className="text-sm text-white/85">
        Thank you — you are on the list. We only send planning tips, and you can unsubscribe from
        any email.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          aria-invalid={Boolean(fieldError(state, 'email')) || undefined}
          /*
            Every colour here is white at some alpha over a near-black maroon,
            so each one picks up the background's warmth: at 50% the
            placeholder composited to a muddy brown-grey, and at 10% the field
            was within a few points of the footer itself and did not read as an
            input at all. Raised until the field looks like a field and the
            hint looks like text rather than a smudge — 4.85:1 already cleared
            AA, so this is about looking deliberate, not about passing.

            The focus outline is overridden to white rather than removed: the
            global `:focus-visible` rule in globals.css draws it in brand-500,
            which is a maroon that all but disappears on this near-black maroon
            panel.
          */
          className="h-11 flex-1 rounded-full border border-white/30 bg-white/15 px-4 text-sm text-white placeholder:text-white/70 focus:border-white/50 focus:bg-white/20 focus-visible:outline-white"
        />
        <SubmitButton className="rounded-full" pendingLabel="Signing up…">
          <Mail aria-hidden="true" />
          Subscribe
        </SubmitButton>
      </div>

      {fieldError(state, 'email') ? (
        <p role="alert" className="text-xs text-white/80">
          {fieldError(state, 'email')}
        </p>
      ) : null}

      <p className="text-xs text-white/55">
        Planning tips only. No vendor spam, and we never share your address.
      </p>
    </form>
  )
}
