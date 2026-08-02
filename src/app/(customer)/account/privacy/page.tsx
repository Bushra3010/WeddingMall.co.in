import Link from 'next/link'

import { DataRequestForm } from '@/components/customer/data-request-form'
import { formatDateTime } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/server/policies/require'

export const metadata = { title: 'Privacy', ...NOINDEX }
export const dynamic = 'force-dynamic'

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  requested: { label: 'Received', tone: 'text-sand-700' },
  processing: { label: 'In progress', tone: 'text-sand-700' },
  completed: { label: 'Completed', tone: 'text-[var(--color-success)]' },
  rejected: { label: 'Declined', tone: 'text-[var(--color-danger)]' },
}

export default async function AccountPrivacyPage() {
  await requireUser('/account/privacy')
  const supabase = await createClient()

  const [{ data: requests }, shortlists, enquiries, reviews] = await Promise.all([
    supabase
      .from('data_requests')
      .select('id, type, status, requested_at, completed_at, notes')
      .order('requested_at', { ascending: false }),
    // `head: true` returns a count and a null body, so these read `count` —
    // destructuring `data` here would silently render zero for everyone.
    // RLS scopes each to the caller, so the totals are theirs by construction
    // rather than by a filter this page has to remember.
    supabase.from('shortlists').select('id', { count: 'exact', head: true }),
    supabase.from('enquiries').select('id', { count: 'exact', head: true }),
    supabase.from('reviews').select('id', { count: 'exact', head: true }),
  ])

  const counts = [
    { label: 'Enquiries', value: enquiries.count ?? 0 },
    { label: 'Shortlisted vendors', value: shortlists.count ?? 0 },
    { label: 'Reviews written', value: reviews.count ?? 0 },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Privacy</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          What we hold about you, and how to get a copy or have it removed. Our{' '}
          <Link href="/privacy" className="text-brand-700 hover:underline">
            privacy page
          </Link>{' '}
          explains who can see what.
        </p>
      </header>

      <section aria-labelledby="privacy-holdings">
        <h2 id="privacy-holdings" className="font-display text-sand-900 text-lg">
          What is on your account
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {counts.map((item) => (
            <div
              key={item.label}
              className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4"
            >
              <dt className="text-sand-500 text-xs tracking-wide uppercase">{item.label}</dt>
              <dd className="font-display text-sand-900 mt-1 text-2xl">{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sand-600 mt-3 max-w-prose text-sm">
          Your contact details are shared with a vendor only when you consent on a specific enquiry.
          Every one of those releases is recorded.
        </p>
      </section>

      <section aria-labelledby="privacy-requests" className="space-y-4">
        <div>
          <h2 id="privacy-requests" className="font-display text-sand-900 text-lg">
            Request your data
          </h2>
          <p className="text-sand-600 mt-1 max-w-prose text-sm">
            {/*
              Honest about the trade-off rather than promising an instant wipe:
              enquiry history may be needed to resolve a live booking, so
              deletion is reviewed and some records are anonymised instead.
            */}
            Requests are handled by a person, not instantly. Deletion removes your profile and
            preferences; enquiries you sent are anonymised rather than erased where a vendor still
            needs them for a booking in progress.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4">
            <p className="text-sand-900 font-medium">Get a copy</p>
            <p className="text-sand-600 mt-1 mb-3 text-sm">
              A machine-readable export of your account, enquiries, shortlist, and reviews.
            </p>
            <DataRequestForm type="export" label="Request an export" />
          </div>
          <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4">
            <p className="text-sand-900 font-medium">Delete your account</p>
            <p className="text-sand-600 mt-1 mb-3 text-sm">
              This cannot be undone once completed. We will confirm before anything is removed.
            </p>
            <DataRequestForm type="deletion" label="Request deletion" />
          </div>
        </div>
      </section>

      {(requests ?? []).length > 0 ? (
        <section aria-labelledby="privacy-history">
          <h2 id="privacy-history" className="font-display text-sand-900 text-lg">
            Your requests
          </h2>
          <div className="border-sand-200 mt-3 overflow-x-auto rounded-[var(--radius-card)] border">
            <table className="w-full min-w-[30rem] text-sm">
              <caption className="sr-only">Data requests you have made</caption>
              <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Requested
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Completed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-sand-200 divide-y bg-white">
                {(requests ?? []).map((row) => {
                  const status = STATUS_COPY[row.status] ?? {
                    label: row.status,
                    tone: 'text-sand-700',
                  }
                  return (
                    <tr key={row.id}>
                      <td className="text-sand-900 px-4 py-3 capitalize">{row.type}</td>
                      <td className={cn('px-4 py-3', status.tone)}>{status.label}</td>
                      <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                        {formatDateTime(row.requested_at)}
                      </td>
                      <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                        {row.completed_at ? formatDateTime(row.completed_at) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
