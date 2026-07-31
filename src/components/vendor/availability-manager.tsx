'use client'

import { CalendarPlus, Trash2 } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { deleteAvailabilityAction, saveAvailabilityAction } from '@/features/listings/actions'
import { AVAILABILITY_STATUSES } from '@/features/listings/schema'
import { formatDate } from '@/lib/dates'
import type { AvailabilityRow } from '@/server/dal/listings'

const TONE: Record<string, string> = {
  available: 'text-[var(--color-success)]',
  busy: 'text-[var(--color-warning)]',
  unavailable: 'text-[var(--color-danger)]',
}

/**
 * Availability (PRD 6.9). The public profile shows only a signal — never the
 * private note, and never a guarantee the vendor has not confirmed (PRD 6.3).
 */
export function AvailabilityManager({
  vendorId,
  entries,
  readOnly,
}: {
  vendorId: string
  entries: AvailabilityRow[]
  readOnly: boolean
}) {
  const [saveState, save] = useAction(saveAvailabilityAction)
  const [deleteState, remove] = useAction(deleteAvailabilityAction)

  return (
    <div className="space-y-6">
      <FormMessage state={saveState} successMessage="Availability saved." />
      <FormMessage state={deleteState} successMessage="Entry removed." />

      {entries.length === 0 ? (
        <p className="border-sand-300 text-sand-600 rounded-[var(--radius-card)] border border-dashed bg-white p-6 text-center text-sm">
          No dates marked. Couples will see that you have not shared availability.
        </p>
      ) : (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-[var(--radius-card)] border bg-white">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sand-900 text-sm font-medium">
                  {formatDate(entry.startDate, 'UTC')}
                  {entry.endDate !== entry.startDate
                    ? ` – ${formatDate(entry.endDate, 'UTC')}`
                    : ''}
                </p>
                <p className={`text-xs font-medium ${TONE[entry.status] ?? 'text-sand-600'}`}>
                  {entry.status}
                </p>
                {entry.note ? (
                  <p className="text-sand-500 mt-1 text-xs">Private note: {entry.note}</p>
                ) : null}
              </div>
              {!readOnly ? (
                <form action={remove}>
                  <input type="hidden" name="vendorId" value={vendorId} />
                  <input type="hidden" name="entryId" value={entry.id} />
                  <Button type="submit" variant="ghost" size="sm" aria-label="Remove this entry">
                    <Trash2 aria-hidden="true" />
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!readOnly ? (
        <form
          action={save}
          className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
        >
          <h2 className="font-display text-sand-900 text-lg">Mark dates</h2>
          <input type="hidden" name="vendorId" value={vendorId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" error={fieldError(saveState, 'startDate')} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="startDate"
                  type="date"
                  required
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
            <Field label="To" error={fieldError(saveState, 'endDate')} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="endDate"
                  type="date"
                  required
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>

          <Field label="Status" required>
            {({ id }) => (
              <select
                id={id}
                name="status"
                defaultValue="unavailable"
                className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
              >
                {AVAILABILITY_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Private note" hint="Only your team sees this. Never shown publicly.">
            {({ id }) => <Textarea id={id} name="note" />}
          </Field>

          <SubmitButton pendingLabel="Saving…">
            <CalendarPlus aria-hidden="true" />
            Mark these dates
          </SubmitButton>
        </form>
      ) : null}
    </div>
  )
}
