'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

/**
 * Root error boundary (PRD 14.2). The digest is shown so a user can quote it to
 * support; the underlying error is never rendered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Sentry adapter reports here once SENTRY_DSN is configured.
    console.error(JSON.stringify({ level: 'error', message: 'route.error', digest: error.digest }))
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-sand-900 text-2xl">Something went wrong</h1>
      <p className="text-sand-600 mt-2 max-w-prose text-sm">
        We hit an unexpected problem. Trying again often works.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
      {error.digest ? (
        <p className="text-sand-400 mt-4 text-xs">Reference: {error.digest}</p>
      ) : null}
    </div>
  )
}
