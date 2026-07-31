import type { ComponentProps, ReactNode } from 'react'
import { useId } from 'react'

import { cn } from '@/lib/utils'

/**
 * Labels, hints, and errors are programmatically associated with the control
 * (PRD 7.3). Errors use `role="alert"` so they are announced on submit.
 */

interface FieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sand-800 block text-sm font-medium">
        {label}
        {required ? (
          <span className="ml-0.5 text-[var(--color-danger)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-sand-600 text-xs">
          {hint}
        </p>
      ) : null}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Input({
  className,
  invalid,
  ...props
}: ComponentProps<'input'> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'border-sand-300 text-sand-900 placeholder:text-sand-400 h-11 w-full rounded-lg border bg-white px-3 text-sm',
        'aria-invalid:border-[var(--color-danger)]',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        'border-sand-300 text-sand-900 placeholder:text-sand-400 min-h-28 w-full rounded-lg border bg-white p-3 text-sm',
        'aria-invalid:border-[var(--color-danger)]',
        className,
      )}
      {...props}
    />
  )
}
