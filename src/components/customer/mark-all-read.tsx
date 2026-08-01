'use client'

import { useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { markNotificationsReadAction } from '@/features/enquiries/actions'

/**
 * Wrapped in useActionState rather than passed straight to `form action`:
 * a Server Action used as a form action must return void, and this one returns
 * an ActionResult so failures are reportable.
 */
export function MarkAllReadButton() {
  const [, action] = useAction(markNotificationsReadAction)

  return (
    <form action={action}>
      <SubmitButton pendingLabel="Marking…">Mark all as read</SubmitButton>
    </form>
  )
}
