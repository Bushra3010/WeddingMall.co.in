'use client'

import { FormMessage, fieldError, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { addEnquiryNoteAction, updateEnquiryCrmAction } from '@/features/enquiries/actions'

/**
 * Vendor-only CRM controls on an enquiry (PRD 6.9).
 *
 * Everything here is internal. `enquiry_notes` has no customer-facing policy
 * and the quote/lost-reason columns are never selected by the customer's DAL,
 * so none of it reaches the shared thread — but the panel says so explicitly,
 * because a vendor who is unsure will simply not use it.
 */
export function EnquiryNotes({
  enquiryId,
  notes,
}: {
  enquiryId: string
  notes: { id: string; note: string; followUpAt: string | null; createdAt: string }[]
}) {
  const [state, action] = useAction(addEnquiryNoteAction)

  return (
    <section
      aria-labelledby="crm-notes"
      className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4"
    >
      <h2 id="crm-notes" className="font-display text-sand-900 text-lg">
        Internal notes
      </h2>
      <p className="text-sand-500 mt-0.5 text-xs">
        Only your team can see these. The customer never does.
      </p>

      {notes.length > 0 ? (
        <ul className="divide-sand-100 mt-3 divide-y">
          {notes.map((note) => (
            <li key={note.id} className="py-2">
              <p className="text-sand-800 text-sm whitespace-pre-line">{note.note}</p>
              <p className="text-sand-500 mt-0.5 text-xs">
                {new Date(note.createdAt).toLocaleDateString()}
                {note.followUpAt
                  ? ` · follow up ${new Date(note.followUpAt).toLocaleDateString()}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="enquiryId" value={enquiryId} />
        <FormMessage state={state} successMessage="Note saved." />

        <Field label="Add a note" error={fieldError(state, 'note')}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              name="note"
              required
              maxLength={2000}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Follow up on" error={fieldError(state, 'followUpAt')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="followUpAt"
              type="date"
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <SubmitButton pendingLabel="Saving…">Save note</SubmitButton>
      </form>
    </section>
  )
}

export function EnquiryDealFields({
  enquiryId,
  quoteAmountMinor,
  lostReason,
  currency,
}: {
  enquiryId: string
  quoteAmountMinor: number | null
  lostReason: string | null
  currency: string
}) {
  const [state, action] = useAction(updateEnquiryCrmAction)

  return (
    <section
      aria-labelledby="crm-deal"
      className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4"
    >
      <h2 id="crm-deal" className="font-display text-sand-900 text-lg">
        Deal details
      </h2>
      <p className="text-sand-500 mt-0.5 text-xs">
        Used for your own reporting. Not shown to the customer.
      </p>

      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="enquiryId" value={enquiryId} />
        <FormMessage state={state} successMessage="Saved." />

        <Field
          label={`Quote amount (${currency}, whole rupees)`}
          error={fieldError(state, 'quoteAmount')}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="quoteAmount"
              type="number"
              min={0}
              step={1}
              // Minor units in the database, rupees in the field — the service
              // converts, so nothing here has to know about the factor.
              defaultValue={quoteAmountMinor === null ? '' : Math.round(quoteAmountMinor / 100)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="If lost, why?" error={fieldError(state, 'lostReason')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="lostReason"
              defaultValue={lostReason ?? ''}
              maxLength={500}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
      </form>
    </section>
  )
}
