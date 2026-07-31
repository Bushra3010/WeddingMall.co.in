import Link from 'next/link'
import { Building2, Clock, MapPin, Tags } from 'lucide-react'

import { NOINDEX } from '@/lib/seo'
import { requireAdmin } from '@/server/policies/require'
import { getAdminDashboardCounts } from '@/server/dal/admin'

export const metadata = { title: 'Admin dashboard', ...NOINDEX }
export const dynamic = 'force-dynamic'

/** PRD 6.11 — queues and supply at a glance. Dashboards must tolerate empty
 * datasets (Epic E), so every tile renders at zero without special-casing. */
export default async function AdminDashboardPage() {
  await requireAdmin()
  const counts = await getAdminDashboardCounts()

  const queues = [
    {
      href: '/admin/verifications',
      icon: Clock,
      label: 'Awaiting verification',
      value: counts.pendingReview,
      urgent: counts.pendingReview > 0,
    },
    {
      href: '/admin/vendors?status=active',
      icon: Building2,
      label: 'Live businesses',
      value: counts.activeVendors,
      urgent: false,
    },
    {
      href: '/admin/categories',
      icon: Tags,
      label: 'Categories',
      value: counts.categories,
      urgent: false,
    },
    {
      href: '/admin/locations',
      icon: MapPin,
      label: 'Cities',
      value: counts.cities,
      urgent: false,
    },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Dashboard</h1>
        <p className="text-sand-600 mt-1 text-sm">Queues, supply, and taxonomy.</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {queues.map((tile) => (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className={`block rounded-[var(--radius-card)] border p-5 transition-colors ${
                tile.urgent
                  ? 'border-accent-500 bg-accent-100 hover:border-accent-700'
                  : 'border-sand-200 hover:border-brand-300 bg-white'
              }`}
            >
              <tile.icon aria-hidden="true" className="text-brand-600 size-5" />
              <p className="text-sand-900 mt-3 text-2xl font-semibold">{tile.value}</p>
              <p className="text-sand-600 text-sm">{tile.label}</p>
            </Link>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="font-display text-sand-900 text-lg">Supply by status</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ['Draft', counts.draftVendors],
            ['Awaiting review', counts.pendingReview],
            ['Live', counts.activeVendors],
            ['Suspended', counts.suspendedVendors],
            ['Rejected', counts.rejectedVendors],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="border-sand-200 rounded-lg border bg-white px-4 py-3"
            >
              <dt className="text-sand-500 text-xs tracking-wide uppercase">{label}</dt>
              <dd className="text-sand-900 text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
