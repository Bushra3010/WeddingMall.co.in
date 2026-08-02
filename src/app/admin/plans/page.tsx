import { Check, Minus } from 'lucide-react'

import { EmptyState } from '@/components/ui/states'
import { formatMoney, money } from '@/lib/money'
import { NOINDEX } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/server/policies/require'

export const metadata = { title: 'Plans', ...NOINDEX }
export const dynamic = 'force-dynamic'

const ENTITLEMENTS = [
  ['listings', 'Listings'],
  ['categories', 'Categories'],
  ['media', 'Images'],
  ['teamSize', 'Team'],
  ['leadQuota', 'Lead quota'],
  ['analytics', 'Analytics'],
  ['featured', 'Featured'],
  ['export', 'Export'],
] as const

function Value({ value }: { value: unknown }) {
  if (value === true)
    return <Check aria-label="Included" className="size-4 text-[var(--color-success)]" />
  if (value === false) return <Minus aria-label="Not included" className="text-sand-400 size-4" />
  // `null` means unlimited in the entitlements JSON, not missing.
  if (value === null) return <span>Unlimited</span>
  return <span>{String(value ?? '—')}</span>
}

export default async function AdminPlansPage() {
  await requireAdmin('billing.manage')
  const supabase = await createClient()

  const [{ data: plans }, { data: subscriptions }] = await Promise.all([
    supabase
      .from('plans')
      .select('id, code, name, amount_minor, currency, billing_interval, entitlements_json, active')
      .order('sort_order'),
    supabase.from('subscriptions').select('plan_id, status'),
  ])

  // Live subscriptions per plan, so an admin can see what a pricing change
  // would affect before making one.
  const counts = new Map<string, number>()
  for (const row of subscriptions ?? []) {
    if (!['trialing', 'active', 'past_due'].includes(row.status)) continue
    counts.set(row.plan_id, (counts.get(row.plan_id) ?? 0) + 1)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Plans</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Entitlements are enforced in SQL, not here — `vendor_may_be_featured()` reads the live
          subscription, so a plan change takes effect for every vendor on it immediately. Editing
          prices and entitlements is not yet exposed; use a migration so the change is reviewable.
        </p>
      </header>

      {(plans ?? []).length === 0 ? (
        <EmptyState title="No plans" description="Seed them with a migration." />
      ) : (
        <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
          <table className="w-full min-w-[46rem] text-sm">
            <caption className="sr-only">Plans and their entitlements</caption>
            <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Plan
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Price
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Subscribers
                </th>
                {ENTITLEMENTS.map(([key, label]) => (
                  <th key={key} scope="col" className="px-3 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-sand-200 divide-y bg-white">
              {(plans ?? []).map((plan) => {
                const ent = (plan.entitlements_json ?? {}) as Record<string, unknown>
                return (
                  <tr key={plan.id}>
                    <td className="text-sand-900 px-4 py-3 font-medium">
                      {plan.name}
                      {!plan.active ? (
                        <span className="text-sand-500 ml-2 text-xs">(inactive)</span>
                      ) : null}
                      <span className="text-sand-400 block font-mono text-xs">{plan.code}</span>
                    </td>
                    <td className="text-sand-700 px-4 py-3 whitespace-nowrap">
                      {plan.amount_minor === 0
                        ? 'Free'
                        : formatMoney(money(plan.amount_minor, plan.currency))}
                      <span className="text-sand-400 block text-xs">{plan.billing_interval}</span>
                    </td>
                    <td className="text-sand-700 px-4 py-3">{counts.get(plan.id) ?? 0}</td>
                    {ENTITLEMENTS.map(([key]) => (
                      <td key={key} className="text-sand-700 px-3 py-3">
                        <Value value={ent[key]} />
                      </td>
                    ))}
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
