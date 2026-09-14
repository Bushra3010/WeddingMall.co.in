'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'

import { useAction } from '@/components/shared/action-form'
import { useSession } from '@/components/shared/session-provider'
import { toggleShortlistAction } from '@/features/enquiries/actions'
import { cn } from '@/lib/utils'

/**
 * Compact save control for a vendor card (PRD 6.5).
 *
 * Distinct from `ShortlistButton`, which is the full-width control on a
 * vendor's own page. This one floats over card artwork. It carries a visible
 * label as well as an `aria-label`: a lone heart over a photograph is read as
 * "like" as often as "save", and the word costs a card nothing.
 *
 * Signed-out visitors get a link to sign in rather than a button that submits
 * and fails: an authentication error surfacing as a red message under a heart
 * icon is a poor way to learn that an account is required.
 *
 * It must not be nested inside the card's `<Link>` — a form inside an anchor
 * is invalid HTML that browsers recover from inconsistently. The card
 * positions this as a sibling instead.
 *
 * Session and saved state come from the browser, not from props: asking the
 * server would make every page carrying a vendor card uncacheable (ADR-030).
 */
export function SaveButton({
  vendorId,
  vendorSlug,
  vendorName,
  className,
}: {
  vendorId: string
  vendorSlug: string
  vendorName: string
  className?: string
}) {
  const { signedIn, shortlistedIds } = useSession()
  const [state, action, pending] = useAction(toggleShortlistAction)
  // A confirmed toggle outranks the loaded set, so the icon never snaps back.
  const saved = state?.ok ? state.data.shortlisted : shortlistedIds.has(vendorId)
  const failed = state !== null && !state.ok

  const shell =
    'inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-soft)] backdrop-blur transition-transform duration-200 hover:scale-105 active:scale-95'

  if (!signedIn) {
    return (
      <Link
        href={`/auth/sign-in?next=${encodeURIComponent(`/vendor/${vendorSlug}`)}`}
        aria-label={`Sign in to save ${vendorName}`}
        className={cn(shell, 'text-sand-700 hover:text-blush-600', className)}
      >
        <Heart aria-hidden="true" className="size-3.5" />
        Shortlist
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
          // The ring is the sighted cue for a failed toggle; the live region
          // below is the assistive one.
          failed && 'ring-2 ring-[var(--color-danger)]',
        )}
      >
        <Heart aria-hidden="true" className={cn('size-3.5', saved && 'fill-current')} />
        {saved ? 'Saved' : 'Shortlist'}
      </button>
      {failed ? (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      ) : null}
    </form>
  )
}
