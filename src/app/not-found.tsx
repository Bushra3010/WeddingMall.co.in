import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-brand-800 text-5xl">404</p>
      <h1 className="font-display text-sand-900 mt-3 text-2xl">We could not find that page</h1>
      <p className="text-sand-600 mt-2 max-w-prose text-sm">
        The link may be out of date, or the listing may no longer be published.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className={cn(buttonVariants())}>
          Back to home
        </Link>
        <Link href="/vendors" className={cn(buttonVariants({ variant: 'outline' }))}>
          Browse vendors
        </Link>
      </div>
    </div>
  )
}
