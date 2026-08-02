'use client'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { startCheckoutAction } from '@/features/billing/actions'

/**
 * Starts a checkout for a plan (PRD 6.10).
 *
 * The action redirects to the provider on success, so there is no success
 * state to render here — only the failure path needs a message.
 */
export function PlanChooser({
  vendorId,
  planCode,
  planName,
}: {
  vendorId: string
  planCode: string
  planName: string
}) {
  const [state, action] = useAction(startCheckoutAction)

  return (
    <form action={action}>
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="planCode" value={planCode} />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Starting…">
        Choose {planName}
      </SubmitButton>
    </form>
  )
}
