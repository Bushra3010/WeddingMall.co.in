import { LogOut } from 'lucide-react'

import { signOut } from '@/features/auth/actions'
import { cn } from '@/lib/utils'

/**
 * Sign out. A form posting to a Server Action rather than a link, so it is a
 * POST and cannot be triggered by a crawler or a prefetch.
 */
export function SignOutButton({
  className,
  label = 'Sign out',
}: {
  className?: string
  label?: string
}) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn(
          'text-sand-700 hover:bg-sand-100 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
          className,
        )}
      >
        <LogOut aria-hidden="true" className="size-4" />
        {label}
      </button>
    </form>
  )
}
