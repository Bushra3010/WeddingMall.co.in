import { NewPlanForm, PlanRow } from '@/components/admin/plan-form'
import { EmptyState } from '@/components/ui/states'
import { NOINDEX } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { requireElevatedAdmin } from '@/server/policies/require'

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

export default async function AdminPlansPage() {
  await requireElevatedAdmin('billing.manage')
  const supabase = await createClient()

  const [{ data: plans }, { data: subscriptions }] = await Promise.all([
    supabase
      .from('plans')
      .select(
        'id, code, name, amount_minor, currency, billing_interval, trial_days, sort_order, entitlements_json, active',
      )
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
          subscription, so a plan change takes effect for every vendor on it immediately. The
          subscriber count is shown before you edit for that reason.
        </p>
      </header>

      {(plans ?? []).length === 0 ? (
        <EmptyState title="No plans" description="Add the first one to get started." />
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
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-sand-200 divide-y bg-white">
              {(plans ?? []).map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  subscribers={counts.get(plan.id) ?? 0}
                  columns={ENTITLEMENTS}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewPlanForm />
    </div>
  )
}
