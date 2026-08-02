import Link from 'next/link'

import { EmptyState } from '@/components/ui/states'
import { formatDateTime } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { requireElevatedAdmin } from '@/server/policies/require'

export const metadata = { title: 'Audit log', ...NOINDEX }
export const dynamic = 'force-dynamic'

const ACTIONS = [
  { key: 'all', label: 'Everything' },
  { key: 'pii.reveal', label: 'PII reveals' },
  { key: 'data.export', label: 'Exports' },
  { key: 'review.moderate', label: 'Review decisions' },
  { key: 'vendor.moderate', label: 'Vendor decisions' },
  { key: 'role.change', label: 'Role changes' },
] as const

/** Sensitive actions are tinted so a scan finds them without reading every row. */
const TONE: Record<string, string> = {
  'pii.reveal': 'text-[var(--color-danger)]',
  'data.export': 'text-[var(--color-danger)]',
  'role.change': 'text-[var(--color-danger)]',
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>
}) {
  // `admin.manage` rather than a lesser permission: the log records who
  // revealed which customer's details, so reading it is itself privileged.
  await requireElevatedAdmin('admin.manage')

  const params = await searchParams
  const action = ACTIONS.some((a) => a.key === params.action) ? params.action! : 'all'

  const supabase = await createClient()
  let query = supabase
    .from('audit_logs')
    .select(
      // `profiles` holds no email — that lives in `auth.users`, which is
      // deliberately not joinable from application queries.
      'id, action, entity_type, entity_id, actor_type, reason, after_json, created_at, profiles(full_name)',
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (action !== 'all') query = query.eq('action', action)

  const { data: entries } = await query

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Audit log</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Append-only. Nothing here can be edited or deleted through the application — the table has
          a read policy and no write policy, so records are written by the server with the service
          role and not even an administrator can revise them.
        </p>
      </header>

      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {ACTIONS.map((item) => (
          <Link
            key={item.key}
            href={item.key === 'all' ? '/admin/audit-log' : `/admin/audit-log?action=${item.key}`}
            aria-current={item.key === action ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              item.key === action
                ? 'bg-brand-700 text-white'
                : 'border-sand-300 text-sand-700 hover:bg-sand-100 border',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {(entries ?? []).length === 0 ? (
        <EmptyState
          title="Nothing recorded"
          description="Entries appear as administrators and vendors take auditable actions."
        />
      ) : (
        <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
          <table className="w-full min-w-[46rem] text-sm">
            <caption className="sr-only">Audit entries, newest first</caption>
            <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  When
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Action
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Actor
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Entity
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody className="divide-sand-200 divide-y bg-white">
              {(entries ?? []).map((entry) => (
                <tr key={entry.id}>
                  <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                    {formatDateTime(entry.created_at)}
                  </td>
                  <td
                    className={cn('px-4 py-3 font-medium', TONE[entry.action] ?? 'text-sand-900')}
                  >
                    {entry.action}
                  </td>
                  <td className="text-sand-700 px-4 py-3">
                    {entry.profiles?.full_name ?? 'Unnamed account'}
                    <span className="text-sand-400 block text-xs">{entry.actor_type}</span>
                  </td>
                  <td className="text-sand-600 px-4 py-3">
                    {entry.entity_type}
                    {entry.entity_id ? (
                      <span className="text-sand-400 block font-mono text-xs">
                        {entry.entity_id.slice(0, 8)}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-sand-600 max-w-72 px-4 py-3 text-xs">
                    {entry.reason ? <span className="block">{entry.reason}</span> : null}
                    {/*
                      The detail column records what happened, never a copy of
                      the disclosed data — a PII reveal logs which fields were
                      released, not their values.
                    */}
                    {entry.after_json ? (
                      <code className="text-sand-500 block break-all">
                        {JSON.stringify(entry.after_json)}
                      </code>
                    ) : null}
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
