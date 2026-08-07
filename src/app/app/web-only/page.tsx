import Image from 'next/image'
import Link from 'next/link'

import { NOINDEX } from '@/lib/seo'
import { site } from '@/lib/site'

export const metadata = { title: 'Open on the web', ...NOINDEX }

/**
 * Where the Android app sends someone who follows a link into /admin.
 *
 * It says which surface is missing and how to reach it, rather than 404ing —
 * an admin who taps a link from an email and gets "not found" will reasonably
 * conclude the admin panel is broken.
 */
export default function WebOnlyPage() {
  return (
    <div className="bg-sand-100 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Image
        src="/logo-wordmark.png"
        alt={site.name}
        width={390}
        height={93}
        className="h-8 w-auto"
      />
      <h1 className="font-display text-sand-900 mt-8 text-2xl">Admin is on the web</h1>
      <p className="text-sand-600 mt-2 max-w-sm text-sm">
        The app carries the couple and vendor workspaces. Managing the catalogue, vendors and
        payments happens in a browser, where the tables and bulk actions have room to work.
      </p>
      <p className="text-sand-500 mt-4 font-mono text-xs">weddingmall.co.in/admin</p>
      <Link
        href="/"
        className="brand-gradient mt-6 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
      >
        Back to WEDDING MALL
      </Link>
    </div>
  )
}
