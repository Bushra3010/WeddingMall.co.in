import Link from 'next/link'

import { formatMoney, money } from '@/lib/money'
import { NOINDEX } from '@/lib/seo'
import { requireElevatedAdmin } from '@/server/policies/require'
import { getMarketplaceReport } from '@/server/dal/reports'

export const metadata = { title: 'Reports', ...NOINDEX }
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
 * Every figure is counted from operational tables. A metric with nothing behind
 * it renders an em dash rather than a zero — "0% conversion" and "no enquiries
 * yet" are different facts, and only one of them is a problem.
 */
export default async function AdminReportsPage() {
  await requireElevatedAdmin('analytics.read')
  const report = await getMarketplaceReport()

  const responseRate = report.delivered > 0 ? report.answered / report.delivered : null
  const bookingRate = report.delivered > 0 ? report.booked / report.delivered : null
  const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Reports</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Counted live from operational tables. A metric with nothing behind it shows a dash rather
          than a zero — no enquiries yet is not the same fact as nobody replying.
        </p>
      </header>

      <section aria-labelledby="reports-supply">
        <h2 id="reports-supply" className="font-display text-sand-900 text-lg">
          Supply
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Vendors" value={String(report.vendors)} />
          <Stat label="Published" value={String(report.published)} />
          <Stat label="Approved reviews" value={String(report.approvedReviews)} />
          <Stat
            label="Awaiting moderation"
            value={String(report.pendingReviews)}
            hint={report.pendingReviews > 0 ? 'Needs attention' : undefined}
          />
        </div>
      </section>

      <section aria-labelledby="reports-demand">
        <h2 id="reports-demand" className="font-display text-sand-900 text-lg">
          Demand and conversion
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Enquiries (30 days)" value={String(report.enquiries30d)} />
          <Stat label="Delivered, all time" value={String(report.delivered)} />
          <Stat
            label="Response rate"
            value={pct(responseRate)}
            hint={responseRate === null ? 'Nothing delivered yet' : 'Of delivered enquiries'}
          />
          <Stat
            label="Booking rate"
            value={pct(bookingRate)}
            hint={bookingRate === null ? 'Nothing delivered yet' : 'Reached "booked"'}
          />
        </div>
      </section>

      <section aria-labelledby="reports-revenue">
        <h2 id="reports-revenue" className="font-display text-sand-900 text-lg">
          Revenue
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Collected"
            value={formatMoney(money(report.revenueMinor, report.currency))}
          />
          <Stat label="Successful payments" value={String(report.successfulPayments)} />
          <Stat label="Live subscriptions" value={String(report.activeSubscriptions)} />
        </div>
        <p className="text-sand-600 mt-3 text-sm">
          Detail in{' '}
          <Link href="/admin/payments" className="text-brand-700 hover:underline">
            payments
          </Link>
          , including webhook deliveries.
        </p>
      </section>
    </div>
  )
}
