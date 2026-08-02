import Link from 'next/link'

import { SignOutButton } from '@/components/shared/sign-out-button'
import { requireAdmin } from '@/server/policies/require'
import { site } from '@/lib/site'
import { NOINDEX } from '@/lib/seo'

export const metadata = NOINDEX
export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/vendors', label: 'Vendors' },
  { href: '/admin/verifications', label: 'Verifications' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/attributes', label: 'Attributes' },
  { href: '/admin/locations', label: 'Locations' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/blog', label: 'Blog' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/audit-log', label: 'Audit log' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/admin-users', label: 'Admin users' },
  { href: '/admin/security', label: 'Security' },
]

/**
 * Admin workspace shell. `requireAdmin()` redirects a non-admin away, but each
 * page must still assert its specific permission before reading or writing —
 * membership alone is not authorisation (PRD 4.4, Epic E).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="bg-sand-950 text-sand-100 flex min-h-dvh flex-col">
      <header className="border-sand-800 border-b">
        <div className="mx-auto flex h-14 max-w-[100rem] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="font-display text-lg font-semibold text-white">
            {site.name}
          </Link>
          <span className="bg-sand-800 text-accent-300 rounded-full px-2 py-0.5 text-xs font-medium">
            Admin
          </span>
          <div className="ml-auto">
            <SignOutButton className="text-sand-300 hover:bg-sand-900 hover:text-white" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[100rem] flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Admin" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {NAV.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className="text-sand-300 hover:bg-sand-900 block rounded-lg px-3 py-2 text-sm whitespace-nowrap hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" className="text-sand-900 rounded-[var(--radius-card)] bg-white p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
