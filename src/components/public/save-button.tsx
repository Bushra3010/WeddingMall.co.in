'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'

import { useAction } from '@/components/shared/action-form'
import { toggleShortlistAction } from '@/features/enquiries/actions'
import { cn } from '@/lib/utils'

/**
 * Compact save control for a vendor card (PRD 6.5).
 *
 * Distinct from `ShortlistButton`, which is the labelled full-width control on
 * a vendor's own page. This one is a bare icon floating over card artwork, so
 * it has to carry its whole meaning in `aria-label`.
 *
 * Signed-out visitors get a link to sign in rather than a button that submits
 * and fails: an authentication error surfacing as a red message under a heart
 * icon is a poor way to learn that an account is required.
 *
 * It must not be nested inside the card's `<Link>` — a form inside an anchor
 * is invalid HTML that browsers recover from inconsistently. The card
 * positions this as a sibling instead.
 */
export function SaveButton({
  vendorId,
  vendorSlug,
  vendorName,
  signedIn,
  shortlisted,
  className,
}: {
  vendorId: string
  vendorSlug: string
  vendorName: string
  signedIn: boolean
  shortlisted: boolean
  className?: string
}) {
  const [state, action, pending] = useAction(toggleShortlistAction)
  const saved = state?.ok ? state.data.shortlisted : shortlisted
  const failed = state !== null && !state.ok

  const shell =
    'inline-flex size-9 items-center justify-center rounded-full bg-white/95 shadow-[var(--shadow-soft)] backdrop-blur transition-transform duration-200 hover:scale-110 active:scale-95'

  if (!signedIn) {
    return (
      <Link
        href={`/auth/sign-in?next=${encodeURIComponent(`/vendor/${vendorSlug}`)}`}
        aria-label={`Sign in to save ${vendorName}`}
        className={cn(shell, 'text-sand-500 hover:text-blush-600', className)}
      >
        <Heart aria-hidden="true" className="size-4" />
      </Link>
    )
  }

  return (
    <form action={action} className="contents">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="vendorSlug" value={vendorSlug} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${vendorName} from shortlist` : `Save ${vendorName}`}
        title={failed ? state.message : undefined}
        className={cn(
          shell,
          className,
          saved ? 'text-blush-600' : 'text-sand-500 hover:text-blush-600',
          pending && 'opacity-60',
          // An icon-only control cannot fail silently; the ring is the sighted
          // cue and the live region below is the assistive one.
          failed && 'ring-2 ring-[var(--color-danger)]',
        )}
      >
        <Heart aria-hidden="true" className={cn('size-4', saved && 'fill-current')} />
      </button>
      {failed ? (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      ) : null}
    </form>
  )
}
