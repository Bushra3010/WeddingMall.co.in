'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** Disabled + announced pending state for every Server Action form (PRD 7.2). */
export function SubmitButton({
  children,
  pendingLabel = 'Working…',
  className,
  disabled,
}: {
  children: React.ReactNode
  pendingLabel?: string
  className?: string
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  const isDisabled = disabled || pending

  return (
    <Button type="submit" disabled={isDisabled} aria-busy={pending} className={className}>
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
