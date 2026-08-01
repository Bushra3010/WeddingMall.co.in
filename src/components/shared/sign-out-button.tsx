import { LogOut } from 'lucide-react'

import { signOut } from '@/features/auth/actions'
import { cn } from '@/lib/utils'

/**
 * Sign out. A form posting to a Server Action rather than a link, so it is a
 * POST and cannot be triggered by a crawler or a prefetch.
 *
 * `label` may be hidden on small screens, so the button always carries an
 * accessible name — an icon-only control with no name is unusable with a
 * screen reader and indistinguishable by voice control (PRD 7.3).
 */
export function SignOutButton({
  className,
  showLabel = true,
}: {
  className?: string
  showLabel?: boolean
}) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        aria-label="Sign out"
        className={cn(
          'text-sand-700 hover:bg-sand-100 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
          className,
        )}
      >
        <LogOut aria-hidden="true" className="size-4" />
        {showLabel ? <span>Sign out</span> : null}
      </button>
    </form>
  )
}
