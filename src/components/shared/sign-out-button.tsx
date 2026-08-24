'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/features/auth/actions'
import { cn } from '@/lib/utils'

/**
 * Sign out. Clears the browser client session first, then calls the Server
 * Action which clears the auth cookie and redirects home.
 */
export function SignOutButton({
  className,
  showLabel = true,
}: {
  className?: string
  showLabel?: boolean
}) {
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      // Clear the browser-side session immediately.
      await createClient().auth.signOut()
      // Clear the server-side cookie and redirect.
      await signOut()
    } catch {
      // If the server action fails, the client session is already cleared —
      // force a reload so the header reflects reality.
      router.refresh()
    }
  }

  return (
    <form action={handleSignOut}>
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
