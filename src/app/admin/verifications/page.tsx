import Link from 'next/link'

import { EmptyState } from '@/components/ui/states'
import { formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { requireAdmin } from '@/server/policies/require'
import { getReviewQueue } from '@/server/dal/admin'

export const metadata = { title: 'Verifications', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function VerificationsPage() {
  // Redirects a non-admin and throws for an admin without the permission.
  await requireAdmin('vendor.verify')
  const queue = await getReviewQueue('pending_review')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Verification queue</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Businesses awaiting a decision, oldest submission first.
        </p>
      </header>

      {queue.length === 0 ? (
        <EmptyState
          title="Nothing waiting"
          description="New submissions appear here as vendors complete onboarding."
        />
      ) : (
        <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
          <table className="w-full min-w-[46rem] text-sm">
            <caption className="sr-only">Businesses awaiting verification</caption>
            <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Business
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  City
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Documents
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Waiting
                </th>
              </tr>
            </thead>
            <tbody className="divide-sand-200 divide-y bg-white">
              {queue.map((row) => (
                <tr key={row.id} className="hover:bg-sand-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/vendors/${row.id}`}
                      className="text-brand-700 font-medium hover:underline"
                    >
                      {row.displayName}
                    </Link>
                  </td>
                  <td className="text-sand-700 px-4 py-3">{row.categoryName ?? '—'}</td>
                  <td className="text-sand-700 px-4 py-3">{row.cityName ?? '—'}</td>
                  <td className="text-sand-700 px-4 py-3">
                    {row.documentCount === 0 ? (
                      <span className="text-[var(--color-warning)]">none</span>
                    ) : (
                      row.documentCount
                    )}
                  </td>
                  <td className="text-sand-600 px-4 py-3">
                    {row.submittedAt ? formatRelative(row.submittedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
