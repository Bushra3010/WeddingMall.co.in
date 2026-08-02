import Link from 'next/link'

import { EmptyState } from '@/components/ui/states'
import { formatDateTime } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/server/policies/require'

export const metadata = { title: 'Payments', ...NOINDEX }
export const dynamic = 'force-dynamic'

const TONE: Record<string, string> = {
  succeeded: 'text-[var(--color-success)]',
  pending: 'text-sand-600',
  failed: 'text-[var(--color-danger)]',
  refunded: 'text-sand-600',
}

export default async function AdminPaymentsPage() {
  await requireAdmin('billing.manage')
  const supabase = await createClient()

  const [{ data: payments }, { data: events }] = await Promise.all([
    supabase
      .from('payments')
      .select(
        'id, amount_minor, currency, status, provider, paid_at, created_at, vendors(display_name, slug)',
      )
      .order('created_at', { ascending: false })
      .limit(200),
    /*
     * Webhook deliveries sit alongside payments deliberately. When money looks
     * wrong the first question is whether the provider's event arrived and was
     * processed, and answering it should not require database access.
     */
    supabase
      .from('webhook_events')
      .select('id, provider, external_event_id, type, status, attempts, error, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const succeeded = (payments ?? []).filter((p) => p.status === 'succeeded')
  const total = succeeded.reduce((sum, p) => sum + Number(p.amount_minor ?? 0), 0)
  const failedEvents = (events ?? []).filter((e) => e.status === 'failed')

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Payments</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Webhooks are authoritative for payment state, so nothing here is editable — a correction
          is made by the provider re-sending the event.
        </p>
      </header>

      {failedEvents.length > 0 ? (
        <p className="rounded-[var(--radius-card)] border border-[var(--color-danger)] bg-[color-mix(in_oklch,var(--color-danger)_8%,white)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {failedEvents.length} webhook{' '}
          {failedEvents.length === 1 ? 'delivery has' : 'deliveries have'} failed and will be
          reprocessed on the provider&apos;s next retry.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4">
          <p className="text-sand-500 text-xs tracking-wide uppercase">Collected</p>
          <p className="font-display text-sand-900 mt-1 text-2xl">
            {formatMoney(money(total, succeeded[0]?.currency ?? 'INR'))}
          </p>
        </div>
        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4">
          <p className="text-sand-500 text-xs tracking-wide uppercase">Successful payments</p>
          <p className="font-display text-sand-900 mt-1 text-2xl">{succeeded.length}</p>
        </div>
        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4">
          <p className="text-sand-500 text-xs tracking-wide uppercase">Webhook events</p>
          <p className="font-display text-sand-900 mt-1 text-2xl">{(events ?? []).length}</p>
        </div>
      </div>

      <section aria-labelledby="admin-payments-list">
        <h2 id="admin-payments-list" className="font-display text-sand-900 text-lg">
          Payments
        </h2>
        {(payments ?? []).length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No payments yet"
              description="They appear here once a provider webhook records one."
            />
          </div>
        ) : (
          <div className="border-sand-200 mt-3 overflow-x-auto rounded-[var(--radius-card)] border">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">All payments</caption>
              <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Vendor
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Provider
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    When
                  </th>
                </tr>
              </thead>
              <tbody className="divide-sand-200 divide-y bg-white">
                {(payments ?? []).map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">
                      {payment.vendors?.slug ? (
                        <Link
                          href={`/vendor/${payment.vendors.slug}`}
                          className="text-brand-700 font-medium hover:underline"
                        >
                          {payment.vendors.display_name}
                        </Link>
                      ) : (
                        <span className="text-sand-500">—</span>
                      )}
                    </td>
                    <td className="text-sand-900 px-4 py-3 whitespace-nowrap">
                      {formatMoney(money(payment.amount_minor, payment.currency))}
                    </td>
                    <td className={cn('px-4 py-3', TONE[payment.status] ?? 'text-sand-700')}>
                      {payment.status}
                    </td>
                    <td className="text-sand-600 px-4 py-3">{payment.provider}</td>
                    <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                      {formatDateTime(payment.paid_at ?? payment.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="admin-webhooks">
        <h2 id="admin-webhooks" className="font-display text-sand-900 text-lg">
          Recent webhook deliveries
        </h2>
        {(events ?? []).length === 0 ? (
          <p className="text-sand-600 mt-2 text-sm">Nothing received yet.</p>
        ) : (
          <div className="border-sand-200 mt-3 overflow-x-auto rounded-[var(--radius-card)] border">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Webhook deliveries</caption>
              <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Event
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Attempts
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    When
                  </th>
                </tr>
              </thead>
              <tbody className="divide-sand-200 divide-y bg-white">
                {(events ?? []).map((event) => (
                  <tr key={event.id}>
                    <td className="text-sand-600 px-4 py-3 font-mono text-xs">
                      {event.external_event_id}
                    </td>
                    <td className="text-sand-700 px-4 py-3">{event.type ?? '—'}</td>
                    <td
                      className={cn(
                        'px-4 py-3',
                        event.status === 'failed'
                          ? 'text-[var(--color-danger)]'
                          : event.status === 'processed'
                            ? 'text-[var(--color-success)]'
                            : 'text-sand-600',
                      )}
                      title={event.error ?? undefined}
                    >
                      {event.status}
                    </td>
                    <td className="text-sand-700 px-4 py-3">{event.attempts}</td>
                    <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                      {formatDateTime(event.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
