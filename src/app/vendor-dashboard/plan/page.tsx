import { Check, Minus } from 'lucide-react'

import { PlanChooser } from '@/components/vendor/plan-chooser'
import { formatMoney, money } from '@/lib/money'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { requireOwnVendorId } from '@/server/policies/require'
import {
  getEntitlements,
  getSubscription,
  getVendorPayments,
  listPlans,
} from '@/server/dal/billing'

export const metadata = { title: 'Plan and billing', ...NOINDEX }
export const dynamic = 'force-dynamic'

const STATUS_COPY: Record<string, string> = {
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Payment overdue',
  paused: 'Paused',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

function Allowance({ label, value }: { label: string; value: string | number | boolean | null }) {
  const rendered = typeof value === 'boolean' ? null : value === null ? 'Unlimited' : String(value)

  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-sand-600">{label}</span>
      {rendered === null ? (
        value ? (
          <Check aria-label="Included" className="size-4 text-[var(--color-success)]" />
        ) : (
          <Minus aria-label="Not included" className="text-sand-400 size-4" />
        )
      ) : (
        <span className="text-sand-900 font-medium">{rendered}</span>
      )}
    </div>
  )
}

export default async function VendorPlanPage() {
  const vendorId = await requireOwnVendorId()
  const [plans, subscription, entitlements, payments] = await Promise.all([
    listPlans(),
    getSubscription(vendorId),
    getEntitlements(vendorId),
    getVendorPayments(vendorId),
  ])

  const currentCode = subscription?.planCode ?? 'free'

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Plan and billing</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Your plan sets how much you can list and whether you can appear as a featured vendor.
          Ending a plan never deletes anything you have added — it only limits what is shown.
        </p>
      </header>

      <section
        aria-labelledby="current-plan"
        className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4"
      >
        <h2 id="current-plan" className="font-display text-sand-900 text-lg">
          Current plan
        </h2>
        <p className="text-sand-900 mt-1 font-medium">
          {subscription?.planName ?? 'Free'}
          {subscription ? (
            <span className="text-sand-500 ml-2 text-sm font-normal">
              {STATUS_COPY[subscription.status] ?? subscription.status}
              {subscription.periodEnd
                ? ` · renews ${new Date(subscription.periodEnd).toLocaleDateString()}`
                : ''}
            </span>
          ) : null}
        </p>

        <div className="divide-sand-100 mt-3 divide-y">
          <Allowance label="Listings" value={entitlements.listings} />
          <Allowance label="Categories" value={entitlements.categories} />
          <Allowance label="Portfolio images" value={entitlements.media} />
          <Allowance label="Team members" value={entitlements.teamSize} />
          <Allowance label="Monthly lead quota" value={entitlements.leadQuota} />
          <Allowance label="Analytics" value={entitlements.analytics} />
          <Allowance label="Featured placement" value={entitlements.featured} />
          <Allowance label="Data export" value={entitlements.export} />
        </div>
      </section>

      <section aria-labelledby="plan-options">
        <h2 id="plan-options" className="font-display text-sand-900 text-lg">
          Available plans
        </h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className={cn(
                'rounded-[var(--radius-card)] border bg-white p-4',
                plan.code === currentCode ? 'border-brand-500' : 'border-sand-200',
              )}
            >
              <p className="text-sand-900 font-medium">{plan.name}</p>
              <p className="font-display text-sand-900 mt-1 text-xl">
                {plan.amountMinor === 0
                  ? 'Free'
                  : formatMoney(money(plan.amountMinor, plan.currency))}
                {plan.amountMinor > 0 ? (
                  <span className="text-sand-500 text-sm font-normal">
                    {plan.billingInterval === 'yearly' ? ' / year' : ' / month'}
                  </span>
                ) : null}
              </p>

              <div className="divide-sand-100 mt-3 divide-y">
                <Allowance label="Listings" value={plan.entitlements.listings} />
                <Allowance label="Images" value={plan.entitlements.media} />
                <Allowance label="Featured" value={plan.entitlements.featured} />
                <Allowance label="Export" value={plan.entitlements.export} />
              </div>

              <div className="mt-4">
                {plan.code === currentCode ? (
                  <p className="text-sand-500 text-sm">Your current plan</p>
                ) : (
                  <PlanChooser vendorId={vendorId} planCode={plan.code} planName={plan.name} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="billing-history">
        <h2 id="billing-history" className="font-display text-sand-900 text-lg">
          Billing history
        </h2>
        {payments.length === 0 ? (
          <p className="text-sand-600 mt-2 text-sm">No payments yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">Payments on this account</caption>
            <thead>
              <tr className="text-sand-500 text-left text-xs uppercase">
                <th scope="col" className="py-2">
                  Date
                </th>
                <th scope="col" className="py-2">
                  Amount
                </th>
                <th scope="col" className="py-2">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-sand-100 divide-y">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="py-2">
                    {new Date(payment.paidAt ?? payment.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2">
                    {formatMoney(money(payment.amountMinor, payment.currency))}
                  </td>
                  <td className="py-2">{payment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
