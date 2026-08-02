'use client'

import { useFormStatus } from 'react-dom'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { toggleStateAction } from '@/features/taxonomy/actions'
import { cn } from '@/lib/utils'

/**
 * Show or hide a state in public filters (PRD 6.11).
 *
 * The button's label describes what pressing it will do, not the current
 * state — "Hide" on a visible row rather than "Visible". A control labelled
 * with its own status reads as a toggle whose direction you have to guess.
 */
function Submit({ active }: { active: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
        active
          ? 'border-sand-300 text-sand-700 hover:bg-sand-100'
          : 'border-brand-300 text-brand-700 hover:bg-brand-50',
      )}
    >
      {pending ? 'Saving…' : active ? 'Hide' : 'Show'}
    </button>
  )
}

export function StateToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [state, action] = useAction(toggleStateAction)

  return (
    <form action={action} className="flex items-center justify-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <span className="sr-only">
        {active ? `Hide ${name} from public filters` : `Show ${name} in public filters`}
      </span>
      {/* Inline so the message lands next to the row it belongs to. */}
      <div className="max-w-64">
        <FormMessage state={state} />
      </div>
      <Submit active={active} />
    </form>
  )
}
