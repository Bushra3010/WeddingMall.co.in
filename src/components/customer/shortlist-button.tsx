'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { useSession } from '@/components/shared/session-provider'
import { SubmitButton } from '@/components/shared/submit-button'
import { buttonVariants } from '@/components/ui/button'
import { toggleShortlistAction } from '@/features/enquiries/actions'
import { cn } from '@/lib/utils'

/**
 * Save/unsave a vendor (PRD 6.5). Renders as a form so it works without client
 * JavaScript; the optimistic label comes from the server-confirmed state.
 *
 * Session and saved state come from the browser, not from props, for the same
 * reason as `SaveButton`: asking the server would make the vendor page
 * uncacheable for every visitor (ADR-030). The toggle itself is still
 * authorised on the server.
 */
export function ShortlistButton({
  vendorId,
  vendorSlug,
  className,
}: {
  vendorId: string
  vendorSlug: string
  className?: string
}) {
  const { signedIn, shortlistedIds } = useSession()
  const [state, action] = useAction(toggleShortlistAction)
  // A confirmed toggle outranks the loaded set, so the label never snaps back.
  const saved = state?.ok ? state.data.shortlisted : shortlistedIds.has(vendorId)

  if (!signedIn) {
    return (
      <Link
        href={`/auth/sign-in?next=${encodeURIComponent(`/vendor/${vendorSlug}`)}`}
        className={cn(buttonVariants({ variant: 'outline' }), 'w-full', className)}
      >
        Sign in to save
      </Link>
    )
  }

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
