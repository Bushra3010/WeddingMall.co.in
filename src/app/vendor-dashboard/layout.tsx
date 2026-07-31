import Link from 'next/link'

import { requireUser } from '@/server/policies/require'
import { site } from '@/lib/site'
import { NOINDEX } from '@/lib/seo'

export const metadata = NOINDEX
export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/vendor-dashboard', label: 'Overview' },
  { href: '/vendor-dashboard/onboarding', label: 'Onboarding' },
  { href: '/vendor-dashboard/profile', label: 'Business profile' },
  { href: '/vendor-dashboard/listing', label: 'Listing' },
  { href: '/vendor-dashboard/services', label: 'Services' },
  { href: '/vendor-dashboard/packages', label: 'Packages' },
  { href: '/vendor-dashboard/portfolio', label: 'Portfolio' },
  { href: '/vendor-dashboard/availability', label: 'Availability' },
  { href: '/vendor-dashboard/enquiries', label: 'Enquiries' },
  { href: '/vendor-dashboard/team', label: 'Team' },
  { href: '/vendor-dashboard/analytics', label: 'Analytics' },
  { href: '/vendor-dashboard/plan', label: 'Plan' },
  { href: '/vendor-dashboard/settings', label: 'Settings' },
]

/**
 * Vendor workspace shell. `requireUser` only gets a human to the right sign-in
 * page — per-vendor capability checks happen in each page's service call, and
 * RLS is the real boundary (PRD 10.1).
 */
export default async function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/vendor-dashboard')

  return (
    <div className="bg-sand-100 flex min-h-dvh flex-col">
      <header className="border-sand-200 border-b bg-white">
        <div className="mx-auto flex h-14 max-w-[100rem] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="font-display text-brand-800 text-lg font-semibold">
            {site.name}
          </Link>
          <span className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-xs font-medium">
            Vendor
          </span>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[100rem] flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_1fr]">
        <nav aria-label="Vendor dashboard" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {NAV.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className="text-sand-700 block rounded-lg px-3 py-2 text-sm whitespace-nowrap hover:bg-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" className="rounded-[var(--radius-card)] bg-white p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
