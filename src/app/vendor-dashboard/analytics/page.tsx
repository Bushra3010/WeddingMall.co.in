import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { EmptyState } from '@/components/ui/states'
import { formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { requireOwnVendorId } from '@/server/policies/require'
import { getOverdueEnquiries, getVendorMetrics } from '@/server/dal/metrics'

export const metadata = { title: 'Analytics', ...NOINDEX }
export const dynamic = 'force-dynamic'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4">
      <p className="text-sand-500 text-xs tracking-wide uppercase">{label}</p>
      <p className="font-display text-sand-900 mt-1 text-2xl">{value}</p>
      {hint ? <p className="text-sand-500 mt-0.5 text-xs">{hint}</p> : null}
    </div>
  )
}

/**
 * A bar per day. Deliberately CSS rather than a charting dependency: two
 * series over thirty points does not justify the bundle, and a `<table>`
 * fallback keeps the numbers reachable for anyone the bars do not serve.
 */
function Sparkline({
  series,
}: {
  series: { date: string; enquiries: number; profileViews: number }[]
}) {
  const peak = Math.max(1, ...series.map((point) => point.profileViews))

  return (
    <div>
      <div className="flex h-24 items-end gap-0.5" aria-hidden="true">
        {series.map((point) => (
          <div
            key={point.date}
            title={`${point.date}: ${point.profileViews} views, ${point.enquiries} enquiries`}
            className="bg-brand-200 min-h-px flex-1 rounded-t-sm"
            style={{ height: `${(point.profileViews / peak) * 100}%` }}
          />
        ))}
      </div>
      <table className="sr-only">
        <caption>Daily profile views and enquiries</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Profile views</th>
            <th scope="col">Enquiries</th>
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>{point.profileViews}</td>
              <td>{point.enquiries}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function VendorDashboardAnalyticsPage() {
  const vendorId = await requireOwnVendorId()
  const [metrics, overdue] = await Promise.all([
    getVendorMetrics(vendorId, 30),
    getOverdueEnquiries(vendorId),
  ])

  const hasActivity =
    metrics.profileViews + metrics.enquiries + metrics.shortlistAdds + metrics.messages > 0

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Analytics</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          The last 30 days, counted from real activity. Figures update daily.
        </p>
      </header>

      {overdue.length > 0 ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-danger)] bg-[color-mix(in_oklch,var(--color-danger)_8%,white)] p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-danger)]">
            <AlertTriangle aria-hidden="true" className="size-4" />
            {overdue.length} enquir{overdue.length === 1 ? 'y is' : 'ies are'} past the response
            time
          </p>
          <ul className="mt-2 space-y-1">
            {overdue.slice(0, 5).map((row) => (
              <li key={row.enquiryId} className="text-sand-700 text-sm">
                <Link
                  href={`/vendor-dashboard/enquiries/${row.enquiryId}`}
                  className="text-brand-700 hover:underline"
                >
                  Delivered {formatRelative(row.deliveredAt)}
                </Link>{' '}
                — waiting {Math.round(row.hoursWaiting)} hours
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Profile views" value={String(metrics.profileViews)} />
        <Stat label="Shortlist adds" value={String(metrics.shortlistAdds)} />
        <Stat label="Enquiries" value={String(metrics.enquiries)} />
        <Stat label="Booked" value={String(metrics.bookedCount)} />
        <Stat
          label="Response rate"
          // Null renders as an em dash rather than 0%: no delivered enquiries
          // means nothing has been measured, not that nothing was answered.
          value={metrics.responseRate === null ? '—' : `${Math.round(metrics.responseRate * 100)}%`}
          hint={metrics.responseRate === null ? 'No enquiries delivered yet' : undefined}
        />
        <Stat
          label="Median first reply"
          value={
            metrics.medianResponseHours === null
              ? '—'
              : `${metrics.medianResponseHours.toFixed(1)}h`
          }
          hint={metrics.medianResponseHours === null ? 'Nothing answered yet' : undefined}
        />
        <Stat label="Messages" value={String(metrics.messages)} />
        <Stat
          label="Overdue now"
          value={String(metrics.overdueCount)}
          hint={metrics.overdueCount > 0 ? 'Needs a reply' : undefined}
        />
      </div>

      <section aria-labelledby="analytics-trend">
        <h2 id="analytics-trend" className="font-display text-sand-900 text-lg">
          Daily profile views
        </h2>
        <div
          className={cn(
            'border-sand-200 mt-3 rounded-[var(--radius-card)] border bg-white p-4',
            !hasActivity && 'opacity-60',
          )}
        >
          {metrics.series.length > 0 ? (
            <Sparkline series={metrics.series} />
          ) : (
            <p className="text-sand-600 text-sm">
              No daily figures yet. They appear once the metrics job has run.
            </p>
          )}
        </div>
      </section>

      {!hasActivity ? (
        <EmptyState
          title="No activity in the last 30 days"
          description="Publishing your listing and adding portfolio images is the fastest way to start appearing in search."
          action={{ label: 'Edit your listing', href: '/vendor-dashboard/listing' }}
        />
      ) : null}
    </div>
  )
}
