import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'

import { SessionProvider } from '@/components/shared/session-provider'
import { env } from '@/lib/env'
import { site } from '@/lib/site'

import './globals.css'

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

// Only 600 is ever used with `font-display` — the other two weights were three
// extra font files downloaded on a phone to render nothing.
const heading = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-heading',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  // Matches brand-900; tints browser chrome on mobile.
  themeColor: '#460c07',
  width: 'device-width',
  initialScale: 1,
}

/*
 * Deliberately does NOT read the CSP nonce from headers.
 *
 * Threading a nonce requires `headers()` here, and reading a header in the
 * root layout opts the entire route tree out of static rendering — measured:
 * static routes fell from 12 to 2, which would undo the TTFB work in ADR-030.
 * See `lib/security/csp.ts` for what is enforced instead.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable}`}>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {/*
          Client-side session state. It carries no server data, so wrapping the
          tree here does not stop any route from being statically rendered.
        */}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
