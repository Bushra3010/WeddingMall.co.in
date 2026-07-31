'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** Disabled + announced pending state for every Server Action form (PRD 7.2). */
export function SubmitButton({
  children,
  pendingLabel = 'Working…',
  className,
}: {
  children: React.ReactNode
  pendingLabel?: string
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={className}>
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
