import Image from 'next/image'

import { NOINDEX } from '@/lib/seo'
import { site } from '@/lib/site'

export const metadata = { title: 'Offline', ...NOINDEX }

/**
 * Shown by the service worker when a navigation fails with no network.
 *
 * Statically rendered on purpose: it is precached at install time, so it has to
 * be a page that never depended on a request. It also carries no navigation
 * into the site — every link would fail the same way, and offering them reads
 * as the app being broken rather than the connection.
 */
export default function OfflinePage() {
  return (
    <div className="bg-sand-100 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Image
        src="/logo-wordmark.png"
        alt={site.name}
        width={390}
        height={93}
        className="h-8 w-auto"
      />
      <h1 className="font-display text-sand-900 mt-8 text-2xl">You are offline</h1>
      <p className="text-sand-600 mt-2 max-w-sm text-sm">
        WEDDING MALL needs a connection to show vendors, enquiries, and messages. Everything is
        still here — reconnect and pull up the page again.
      </p>
      {/*
        A real anchor, not `next/link`. This page is served by the service
        worker from its own cache after a navigation failed, so the Next router
        that a `<Link>` depends on may never have booted. A full document
        request is the thing that actually retries the connection.
      */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="brand-gradient mt-6 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
      >
        Try again
      </a>
    </div>
  )
}
