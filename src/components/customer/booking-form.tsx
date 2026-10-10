'use client'

import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { submitBookingAction } from '@/features/enquiries/actions'

/**
 * "Book now" — a direct booking: no quote, no payment.
 *
 * The idempotency key is fixed per render, as on the enquiry form, so a
 * double-tap books once. Sharing name and phone is required to book — the
 * vendor confirms by phone — but it is still a box the customer ticks.
 */
export function BookingForm({
  vendorId,
  vendorName,
  categoryId,
  cityId,
}: {
  vendorId: string
  vendorName: string
  categoryId?: string | null
  cityId?: string | null
}) {
  const [state, action] = useAction(submitBookingAction)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'))

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />

      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}
      {cityId ? <input type="hidden" name="cityId" value={cityId} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Booking date" error={fieldError(state, 'eventDate')} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="eventDate"
              type="date"
              min={today}
              required
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Time" hint="Optional" error={fieldError(state, 'eventTime')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="eventTime"
              type="time"
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>

      <Field label="Guests (approx.)" hint="Optional" error={fieldError(state, 'guestCount')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="guestCount"
            type="number"
            min={0}
            placeholder="e.g. 300"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Anything else?" hint="Optional" error={fieldError(state, 'note')}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="note"
            rows={3}
            maxLength={1500}
            placeholder="Pickup address, function, special requests…"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <div className="border-sand-200 bg-sand-50 rounded-lg border p-4">
        <label className="text-sand-800 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="contactConsent"
            required
            className="border-sand-400 mt-1 size-4 rounded"
          />
          <span>
            Share my name and phone number with {vendorName}.
            <span className="text-sand-600 mt-0.5 block text-xs">
              Needed to book — they will call you to confirm.
            </span>
          </span>
        </label>
        {fieldError(state, 'contactConsent') ? (
          <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">
            {fieldError(state, 'contactConsent')}
          </p>
        ) : null}
      </div>

      <SubmitButton className="w-full" pendingLabel="Booking…">
        <CalendarCheck aria-hidden="true" />
        Book now
      </SubmitButton>

      <p className="text-sand-500 text-xs">No payment needed to book.</p>
    </form>
  )
}
