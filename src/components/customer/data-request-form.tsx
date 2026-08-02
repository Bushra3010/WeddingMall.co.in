'use client'

import { useFormStatus } from 'react-dom'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { Button } from '@/components/ui/button'
import { createDataRequestAction } from '@/features/privacy/actions'

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending} aria-busy={pending}>
      {pending ? 'Sending…' : label}
    </Button>
  )
}

export function DataRequestForm({ type, label }: { type: 'export' | 'deletion'; label: string }) {
  const [state, action] = useAction(createDataRequestAction)

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="type" value={type} />
      <FormMessage
        state={state}
        successMessage="Request received. You can track it in the table below."
      />
      <Submit label={label} />
    </form>
  )
}
