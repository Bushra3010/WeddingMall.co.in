'use client'

import { Heart } from 'lucide-react'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { toggleShortlistAction } from '@/features/enquiries/actions'

/**
 * Save/unsave a vendor (PRD 6.5). Renders as a form so it works without client
 * JavaScript; the optimistic label comes from the server-confirmed state.
 */
export function ShortlistButton({
  vendorId,
  vendorSlug,
  shortlisted,
  className,
}: {
  vendorId: string
  vendorSlug: string
  shortlisted: boolean
  className?: string
}) {
  const [state, action] = useAction(toggleShortlistAction)
  const saved = state?.ok ? state.data.shortlisted : shortlisted

  return (
    <form action={action} className={className}>
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="vendorSlug" value={vendorSlug} />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Saving…">
        <Heart aria-hidden="true" className={saved ? 'fill-current' : ''} />
        {saved ? 'Saved to shortlist' : 'Save to shortlist'}
      </SubmitButton>
    </form>
  )
}
