'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'

import { FormMessage, useAction } from '@/components/shared/action-form'
import type { ActionResult } from '@/lib/action-result'

/**
 * Delete one row, with the confirmation step in front of it.
 *
 * Every admin table deletes something that has children, and the `delete_*()`
 * functions refuse when a row is still in use — naming what is in the way. That
 * message is the reason this is not `window.confirm`: a browser dialogue can
 * ask the question but cannot show the answer, so the refusal would arrive as a
 * toast, or nowhere.
 *
 * `warning` carries the consequence when a delete is allowed to proceed but
 * takes something with it — the attributes screen uses it for the vendor
 * answers that go too. Stated before the second click rather than after.
 */
export function DeleteRowButton({
  id,
  label,
  action,
  warning,
}: {
  id: string
  /** The thing's own name, so both the prompt and the button say what goes. */
  label: string
  action: (prev: unknown, form: FormData) => Promise<ActionResult<unknown>>
  warning?: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [state, formAction] = useAction(action)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="border-sand-300 text-sand-600 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
      >
        <Trash2 aria-hidden="true" className="size-3" />
        Delete<span className="sr-only"> {label}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-sand-700 text-xs">
        Delete {label}? This cannot be undone.
        {warning ? <span className="block text-[var(--color-danger)]">{warning}</span> : null}
      </p>
      {/* The refusal explains what still points at the row, so it is shown
          here rather than somewhere that scrolls away. */}
      <div className="max-w-80 text-left">
        <FormMessage state={state} />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-3 py-1 text-xs font-medium"
        >
          Cancel
        </button>
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <ConfirmButton label={label} />
        </form>
      </div>
    </div>
  )
}

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="rounded-full border border-[var(--color-danger)] px-3 py-1 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_oklch,var(--color-danger)_10%,white)] disabled:opacity-50"
    >
      {pending ? 'Deleting…' : `Delete ${label}`}
    </button>
  )
}
