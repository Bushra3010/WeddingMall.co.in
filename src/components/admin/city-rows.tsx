'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Pencil, Trash2 } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { deleteCityAction, saveCityAction } from '@/features/taxonomy/actions'

/**
 * Edit and delete a city in place (PRD 6.11).
 *
 * `saveCityAction` has always accepted an `id` and updated instead of
 * inserting; nothing in the UI ever sent one. Editing here is that path, not a
 * new one.
 *
 * Delete is deliberately harder to reach than edit. It is irreversible, sits
 * one row away from cities that carry live vendors, and the refusal it may come
 * back with is worth reading rather than clicking past — so it asks first,
 * inline, naming the city. `window.confirm` would have been shorter but it
 * cannot show the reason a delete was refused.
 */

type City = {
  id: string
  name: string
  slug: string
  active: boolean
  sort_order: number
  state_id: string | null
  states: { name: string } | null
}

type State = { id: string; name: string }

const CELL = 'px-4 py-3'

function DeleteButton({ name }: { name: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="rounded-full border border-[var(--color-danger)] px-3 py-1 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_oklch,var(--color-danger)_10%,white)] disabled:opacity-50"
    >
      {pending ? 'Deleting…' : `Delete ${name}`}
    </button>
  )
}

export function CityRow({ city, states }: { city: City; states: State[] }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view')
  const [saveState, saveAction] = useAction(saveCityAction)
  const [deleteState, deleteAction] = useAction(deleteCityAction)

  // Close the editor once the save lands, so the row goes back to showing the
  // values the server now holds rather than the ones that were typed. Adjusted
  // during render rather than in an effect — React's documented way to reset
  // state in response to a change, and the same shape `SiteHeader` uses to
  // close its menu on navigation.
  const [lastSave, setLastSave] = useState(saveState)
  if (lastSave !== saveState) {
    setLastSave(saveState)
    if (saveState?.ok) setMode('view')
  }

  if (mode === 'edit') {
    return (
      <tr>
        <td colSpan={5} className="bg-sand-50 px-4 py-4">
          <form action={saveAction} className="space-y-4">
            <input type="hidden" name="id" value={city.id} />
            {/*
              The slug note lives here rather than under the slug field: a hint
              on one of four side-by-side fields makes that column taller and
              pushes its input out of line with the other three.
            */}
            <h3 className="text-sand-900 text-sm font-semibold">
              Editing {city.name}
              <span className="text-sand-600 ml-2 font-normal">
                Changing the slug leaves a 301 from the old URL.
              </span>
            </h3>
            <FormMessage state={saveState} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="State" error={fieldError(saveState, 'stateId')} required>
                {({ id, describedBy, invalid }) => (
                  <select
                    id={id}
                    name="stateId"
                    required
                    defaultValue={city.state_id ?? ''}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
                  >
                    <option value="">Choose a state</option>
                    {/*
                      A city can sit in a state that is currently hidden. Adding
                      it back keeps the select from silently dropping the row's
                      own value and reassigning the city on save.
                    */}
                    {states.some((s) => s.id === city.state_id) || !city.state_id ? null : (
                      <option value={city.state_id}>{city.states?.name ?? 'Current state'}</option>
                    )}
                    {states.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <Field label="Name" error={fieldError(saveState, 'name')} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="name"
                    required
                    defaultValue={city.name}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>

              <Field label="Slug" error={fieldError(saveState, 'slug')} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="slug"
                    required
                    defaultValue={city.slug}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>

              <Field label="Sort order" error={fieldError(saveState, 'sortOrder')}>
                {({ id }) => (
                  <Input
                    id={id}
                    name="sortOrder"
                    type="number"
                    min={0}
                    defaultValue={city.sort_order}
                  />
                )}
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sand-700 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={city.active}
                  className="border-sand-400 size-4 rounded"
                />
                Visible to the public
              </label>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
              </div>
            </div>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className={`text-sand-900 ${CELL} font-medium`}>{city.name}</td>
      <td className={`text-sand-700 ${CELL}`}>{city.states?.name ?? '—'}</td>
      <td className={`text-sand-600 ${CELL} font-mono text-xs`}>{city.slug}</td>
      <td className={CELL}>
        {city.active ? (
          <span className="text-[var(--color-success)]">yes</span>
        ) : (
          <span className="text-sand-500">hidden</span>
        )}
      </td>
      <td className={`${CELL} text-right`}>
        {mode === 'confirm-delete' ? (
          <div className="flex flex-col items-end gap-2">
            <p className="text-sand-700 text-xs">Delete {city.name}? This cannot be undone.</p>
            {/* The refusal explains what still points at the city, so it is
                shown here rather than as a toast that scrolls away. */}
            <div className="max-w-80 text-left">
              <FormMessage state={deleteState} />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('view')}
                className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-3 py-1 text-xs font-medium"
              >
                Cancel
              </button>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={city.id} />
                <DeleteButton name={city.name} />
              </form>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="border-sand-300 text-sand-700 hover:bg-sand-100 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
            >
              <Pencil aria-hidden="true" className="size-3" />
              Edit<span className="sr-only"> {city.name}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('confirm-delete')}
              className="border-sand-300 text-sand-600 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
            >
              <Trash2 aria-hidden="true" className="size-3" />
              Delete<span className="sr-only"> {city.name}</span>
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
