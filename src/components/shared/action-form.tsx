'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import type { ActionResult } from '@/lib/action-result'

/**
 * Shared wrapper for a Server Action form. Gives every form the required
 * states from PRD 7.2 — validation, permission denied, success confirmation —
 * without each screen reimplementing them.
 */

type State<T> = ActionResult<T> | null

export function useAction<T>(action: (prev: State<T>, form: FormData) => Promise<ActionResult<T>>) {
  return useActionState<State<T>, FormData>(action, null)
}

export function FormMessage<T>({
  state,
  successMessage,
}: {
  state: State<T>
  successMessage?: string
}) {
  if (!state) return null

  if (state.ok) {
    if (!successMessage) return null
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--color-success)_12%,white)] px-3 py-2 text-sm text-[var(--color-success)]"
      >
        <CheckCircle2 aria-hidden="true" className="size-4" />
        {successMessage}
      </p>
    )
  }

  // Field-level errors are rendered next to their inputs; this is the summary.
  if (state.code === 'validation_error') {
    return (
      <p
        role="alert"
        className="rounded-lg bg-[color-mix(in_oklch,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-[var(--color-danger)]"
      >
        {state.message}
      </p>
    )
  }

  return (
    <div
      role="alert"
      className="rounded-lg bg-[color-mix(in_oklch,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-[var(--color-danger)]"
    >
      <p>{state.message}</p>
      {state.code === 'internal_error' ? (
        <p className="mt-1 text-xs opacity-70">Reference: {state.requestId}</p>
      ) : null}
    </div>
  )
}

export function fieldError<T>(state: State<T>, field: string): string | undefined {
  if (!state || state.ok) return undefined
  return state.fieldErrors?.[field]?.[0]
}
