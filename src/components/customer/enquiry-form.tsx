'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { submitEnquiryAction } from '@/features/enquiries/actions'
import { CONTACT_MODES } from '@/features/enquiries/schema'

/**
 * Enquiry form (PRD 6.6).
 *
 * Two details matter here. The idempotency key is generated once per form
 * render, so a double-click or a retry lands on the same key and the RPC
 * returns the original enquiry instead of creating a second one. And contact
 * consent is opt-in and unchecked by default — a vendor must never receive
 * contact details the customer did not agree to share (PRD 2.3).
 */
export function EnquiryForm({
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
  const [state, action] = useAction(submitEnquiryAction)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [dateMode, setDateMode] = useState<'exact' | 'flexible' | 'unknown'>('exact')

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />

      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}
      {cityId ? <input type="hidden" name="cityId" value={cityId} /> : null}

      <fieldset>
        <legend className="text-sand-800 text-sm font-medium">When is your wedding?</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {(
            [
              ['exact', 'I have a date'],
              ['flexible', 'A month, roughly'],
              ['unknown', 'Not decided'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="text-sand-700 flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="dateMode"
                value={value}
                checked={dateMode === value}
                onChange={() => setDateMode(value)}
                className="size-4"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {dateMode === 'exact' ? (
        <Field label="Wedding date" error={fieldError(state, 'eventDate')}>
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
      ) : dateMode === 'flexible' ? (
        <Field label="Roughly which month?" error={fieldError(state, 'flexibleDate')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="flexibleDate"
              type="month"
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guests (approx.)" error={fieldError(state, 'guestCount')}>
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

        <div className="grid grid-cols-2 gap-2">
          <Field label="Budget from (₹)" error={fieldError(state, 'budgetMinMinor')}>
            {({ id }) => <Input id={id} name="budgetMin" type="number" min={0} step={1000} />}
          </Field>
          <Field label="to (₹)" error={fieldError(state, 'budgetMaxMinor')}>
            {({ id }) => <Input id={id} name="budgetMax" type="number" min={0} step={1000} />}
          </Field>
        </div>
      </div>

      <Field
        label={`What would you like to ask ${vendorName}?`}
        hint="The more detail you give, the more useful their reply will be."
        error={fieldError(state, 'message')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="message"
            required
            minLength={20}
            maxLength={2000}
            rows={5}
            placeholder="We are looking for a venue for 300 guests in early March, ideally with on-site rooms."
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="How would you prefer to be contacted?">
        {({ id }) => (
          <select
            id={id}
            name="preferredContactMode"
            defaultValue="in_app"
            className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            {CONTACT_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="border-sand-200 bg-sand-50 rounded-lg border p-4">
        <label className="text-sand-800 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="contactConsent"
            className="border-sand-400 mt-1 size-4 rounded"
          />
          <span>
            Share my name and phone number with {vendorName}.
            <span className="text-sand-600 mt-0.5 block text-xs">
              Optional. Without this they can still reply to you here, and they will not see your
              contact details.
            </span>
          </span>
        </label>
      </div>

      <SubmitButton className="w-full" pendingLabel="Sending…">
        <Send aria-hidden="true" />
        Send enquiry
      </SubmitButton>

      <p className="text-sand-500 text-xs">
        Sending is free. You can close the enquiry at any time from your account.
      </p>
    </form>
  )
}
