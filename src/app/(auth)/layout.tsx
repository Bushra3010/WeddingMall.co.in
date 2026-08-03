import Image from 'next/image'
import Link from 'next/link'

import { site } from '@/lib/site'

/**
 * Auth shell.
 *
 * Carries the same logo as the site header. It sits on the light `sand-100`
 * panel, so the artwork needs no inversion here — unlike the header over the
 * hero and the footer, both of which are dark.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-sand-100 flex min-h-dvh flex-col">
      <header className="p-6">
        <Link href="/" aria-label={`${site.name} — home`} className="inline-flex">
          <Image
            src="/logo-wordmark.png"
            alt={site.name}
            width={390}
            height={93}
            priority
            className="h-8 w-auto"
          />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
