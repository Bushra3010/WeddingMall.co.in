import Link from 'next/link'

import { EmptyState } from '@/components/ui/states'
import { ENQUIRY_STATUS_LABELS } from '@/features/enquiries/status'
import { formatRelative } from '@/lib/dates'
import { formatRange, money } from '@/lib/money'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { requireElevatedAdmin } from '@/server/policies/require'

export const metadata = { title: 'Leads', ...NOINDEX }
export const dynamic = 'force-dynamic'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'unanswered', label: 'Unanswered' },
  { key: 'booked', label: 'Booked' },
  { key: 'spam', label: 'Spam' },
] as const

type Filter = (typeof FILTERS)[number]['key']

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  await requireElevatedAdmin('lead.read')

  const params = await searchParams
  const view: Filter = FILTERS.some((f) => f.key === params.view) ? (params.view as Filter) : 'all'

  const supabase = await createClient()

  let query = supabase
    .from('enquiries')
    .select(
      'id, status, created_at, delivered_at, first_response_at, event_date, budget_min_minor, budget_max_minor, currency, vendors(display_name, slug)',
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (view === 'booked') query = query.eq('status', 'booked')
  if (view === 'spam') query = query.eq('status', 'spam')
  if (view === 'unanswered') query = query.is('first_response_at', null)

  const [{ data: rows }, { data: sla }] = await Promise.all([
    query,
    // The overdue flag is computed by the `enquiry_sla` view against the
    // configured threshold, so this screen and the vendor's own dashboard
    // cannot disagree about what "late" means.
    supabase.from('enquiry_sla').select('enquiry_id, is_overdue, hours_to_first_response'),
  ])

  const slaBy = new Map((sla ?? []).map((row) => [row.enquiry_id, row]))
  const enquiries =
    view === 'overdue' ? (rows ?? []).filter((r) => slaBy.get(r.id)?.is_overdue) : (rows ?? [])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Leads</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Every enquiry across all vendors. Customer names and contact details are deliberately not
          shown here — those are released per enquiry with consent, and each release is audited.
        </p>
      </header>

      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'all' ? '/admin/leads' : `/admin/leads?view=${f.key}`}
            aria-current={f.key === view ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              f.key === view
                ? 'bg-brand-700 text-white'
                : 'border-sand-300 text-sand-700 hover:bg-sand-100 border',
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {enquiries.length === 0 ? (
        <EmptyState title="Nothing here" description="No enquiries match this view." />
      ) : (
        <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">Enquiries across all vendors</caption>
            <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Vendor
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Budget
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Event
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  First reply
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Received
                </th>
              </tr>
            </thead>
            <tbody className="divide-sand-200 divide-y bg-white">
              {enquiries.map((row) => {
                const rowSla = slaBy.get(row.id)
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      {row.vendors?.slug ? (
                        <Link
                          href={`/vendor/${row.vendors.slug}`}
                          className="text-brand-700 font-medium hover:underline"
                        >
                          {row.vendors.display_name}
                        </Link>
                      ) : (
                        <span className="text-sand-500">—</span>
                      )}
                    </td>
                    <td className="text-sand-700 px-4 py-3">
                      {ENQUIRY_STATUS_LABELS[row.status] ?? row.status}
                    </td>
                    <td className="text-sand-700 px-4 py-3 whitespace-nowrap">
                      {formatRange(
                        row.budget_min_minor ? money(row.budget_min_minor, row.currency) : null,
                        row.budget_max_minor ? money(row.budget_max_minor, row.currency) : null,
                      ) ?? '—'}
                    </td>
                    <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                      {row.event_date ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.first_response_at ? (
                        <span className="text-sand-700">
                          {Number(rowSla?.hours_to_first_response ?? 0).toFixed(1)}h
                        </span>
                      ) : rowSla?.is_overdue ? (
                        <span className="text-[var(--color-danger)]">overdue</span>
                      ) : (
                        <span className="text-sand-500">waiting</span>
                      )}
                    </td>
                    <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                      {formatRelative(row.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
