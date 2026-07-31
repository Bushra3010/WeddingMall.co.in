import { Check, Circle } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { CompletionResult } from '@/features/vendors/completion'

/** Profile completion (PRD 6.9). Required items are called out separately so
 * a vendor knows what actually blocks submission. */
export function CompletionMeter({ completion }: { completion: CompletionResult }) {
  return (
    <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sand-900 font-medium">Profile completion</h2>
        <span className="font-display text-brand-700 text-2xl">{completion.score}%</span>
      </div>

      <div
        className="bg-sand-200 mt-3 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={completion.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completion"
      >
        <div
          className="bg-brand-600 h-full rounded-full transition-[width]"
          style={{ width: `${completion.score}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {completion.fields.map((field) => (
          <li key={field.key} className="flex items-start gap-2 text-sm">
            {field.done ? (
              <Check
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]"
              />
            ) : (
              <Circle
                aria-hidden="true"
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  field.required ? 'text-[var(--color-danger)]' : 'text-sand-300',
                )}
              />
            )}
            <span className={cn(field.done ? 'text-sand-500 line-through' : 'text-sand-800')}>
              {field.label}
              {field.required && !field.done ? (
                <span className="ml-1.5 text-xs font-medium text-[var(--color-danger)]">
                  required
                </span>
              ) : null}
              {!field.done ? (
                <span className="text-sand-500 block text-xs">{field.hint}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
