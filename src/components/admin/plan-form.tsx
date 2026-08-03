'use client'

import { useState } from 'react'
import { Check, Minus, Pencil, Plus } from 'lucide-react'

import { DeleteRowButton } from '@/components/admin/delete-row-button'
import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { deletePlanAction, savePlanAction } from '@/features/billing/plan-actions'
import { formatMoney, money } from '@/lib/money'

/**
 * Editing plans and their entitlements (PRD 6.10).
 *
 * Entitlements are eight known keys rendered as typed inputs, not a JSON
 * textarea. `vendor_may_be_featured()` reads this object in SQL, where a
 * mistyped key is not an error — it is simply absent, and the vendor quietly
 * loses the entitlement. A field per key makes the invalid shape unreachable.
 *
 * Quotas are blank for unlimited, matching the `null` the entitlements object
 * uses and the "Unlimited" the table already renders.
 */

export type Plan = {
  id: string
  code: string
  name: string
  amount_minor: number
  currency: string
  billing_interval: string
  trial_days: number
  sort_order: number
  entitlements_json: unknown
  active: boolean
}

const QUOTAS = [
  ['listings', 'Listings'],
  ['categories', 'Categories'],
  ['media', 'Images'],
  ['teamSize', 'Team size'],
  ['leadQuota', 'Lead quota'],
] as const

const FLAGS = [
  ['analytics', 'Analytics'],
  ['featured', 'Featured placement'],
  ['export', 'Export'],
] as const

function readEntitlements(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** Blank input means unlimited, so a `null` entitlement renders as an empty box. */
function quotaValue(value: unknown): string | number {
  return typeof value === 'number' ? value : ''
}

function PlanFields({ plan }: { plan?: Plan }) {
  const ent = readEntitlements(plan?.entitlements_json)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name" required>
          {({ id }) => <Input id={id} name="name" required defaultValue={plan?.name ?? ''} />}
        </Field>
        <Field label="Code" hint="Used by checkout. Lower-case." required>
          {({ id }) => <Input id={id} name="code" required defaultValue={plan?.code ?? ''} />}
        </Field>
        <Field label="Price" hint="In rupees. 0 for free.">
          {({ id }) => (
            <Input
              id={id}
              name="amount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={plan ? plan.amount_minor / 100 : 0}
            />
          )}
        </Field>
        <Field label="Billing interval">
          {({ id }) => (
            <select
              id={id}
              name="billingInterval"
              defaultValue={plan?.billing_interval ?? 'monthly'}
              className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
            >
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
          )}
        </Field>
        <Field label="Currency">
          {({ id }) => (
            <Input id={id} name="currency" maxLength={3} defaultValue={plan?.currency ?? 'INR'} />
          )}
        </Field>
        <Field label="Trial days">
          {({ id }) => (
            <Input
              id={id}
              name="trialDays"
              type="number"
              min={0}
              defaultValue={plan?.trial_days ?? 0}
            />
          )}
        </Field>
        <Field label="Sort order">
          {({ id }) => (
            <Input
              id={id}
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={plan?.sort_order ?? 0}
            />
          )}
        </Field>
        <label className="text-sand-700 flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={plan?.active ?? true}
            className="border-sand-400 size-4 rounded"
          />
          Available at checkout
        </label>
      </div>

      <fieldset className="border-sand-200 rounded-lg border p-4">
        <legend className="text-sand-700 px-2 text-xs font-medium tracking-wide uppercase">
          Entitlements
        </legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {QUOTAS.map(([key, label]) => (
            <Field key={key} label={label} hint="Blank = unlimited">
              {({ id }) => (
                <Input
                  id={id}
                  name={key}
                  type="number"
                  min={0}
                  defaultValue={quotaValue(ent[key])}
                />
              )}
            </Field>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {FLAGS.map(([key, label]) => (
            <label key={key} className="text-sand-700 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={key}
                defaultChecked={ent[key] === true}
                className="border-sand-400 size-4 rounded"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}

export function PlanRow({
  plan,
  subscribers,
  columns,
}: {
  plan: Plan
  subscribers: number
  columns: readonly (readonly [string, string])[]
}) {
  const [editing, setEditing] = useState(false)
  const [state, action] = useAction(savePlanAction)

  const [lastState, setLastState] = useState(state)
  if (lastState !== state) {
    setLastState(state)
    if (state?.ok) setEditing(false)
  }

  const ent = readEntitlements(plan.entitlements_json)

  if (editing) {
    return (
      <tr>
        <td colSpan={columns.length + 4} className="bg-sand-50 px-4 py-4">
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={plan.id} />
            <h3 className="text-sand-900 text-sm font-semibold">
              Editing {plan.name}
              {subscribers > 0 ? (
                <span className="ml-2 font-normal text-[var(--color-danger)]">
                  {subscribers} live {subscribers === 1 ? 'subscription' : 'subscriptions'} — a
                  change here applies to {subscribers === 1 ? 'it' : 'them'} immediately.
                </span>
              ) : null}
            </h3>
            <FormMessage state={state} />
            {/* Field-level errors surface through the shared Field wrapper; the
                summary above covers the rest. */}
            <p className="sr-only">{fieldError(state, 'code') ?? ''}</p>
            <PlanFields plan={plan} />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
            </div>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="text-sand-900 px-4 py-3 font-medium">
        {plan.name}
        {!plan.active ? <span className="text-sand-500 ml-2 text-xs">(inactive)</span> : null}
        <span className="text-sand-400 block font-mono text-xs">{plan.code}</span>
      </td>
      <td className="text-sand-700 px-4 py-3 whitespace-nowrap">
        {plan.amount_minor === 0 ? 'Free' : formatMoney(money(plan.amount_minor, plan.currency))}
        <span className="text-sand-400 block text-xs">{plan.billing_interval}</span>
      </td>
      <td className="text-sand-700 px-4 py-3">{subscribers}</td>
      {columns.map(([key]) => (
        <td key={key} className="text-sand-700 px-3 py-3">
          <EntitlementValue value={ent[key]} />
        </td>
      ))}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="border-sand-300 text-sand-700 hover:bg-sand-100 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
          >
            <Pencil aria-hidden="true" className="size-3" />
            Edit<span className="sr-only"> {plan.name}</span>
          </button>
          <DeleteRowButton id={plan.id} label={plan.name} action={deletePlanAction} />
        </div>
      </td>
    </tr>
  )
}

export function EntitlementValue({ value }: { value: unknown }) {
  if (value === true)
    return <Check aria-label="Included" className="size-4 text-[var(--color-success)]" />
  if (value === false) return <Minus aria-label="Not included" className="text-sand-400 size-4" />
  // `null` means unlimited in the entitlements JSON, not missing.
  if (value === null) return <span>Unlimited</span>
  return <span>{String(value ?? '—')}</span>
}

export function NewPlanForm() {
  const [open, setOpen] = useState(false)
  const [state, action] = useAction(savePlanAction)

  const [lastState, setLastState] = useState(state)
  if (lastState !== state) {
    setLastState(state)
    if (state?.ok) setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-sand-300 text-sand-700 hover:bg-sand-100 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium"
      >
        <Plus aria-hidden="true" className="size-4" />
        Add a plan
      </button>
    )
  }

  return (
    <form
      action={action}
      className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
    >
      <h2 className="font-display text-sand-900 text-lg">New plan</h2>
      <FormMessage state={state} successMessage="Plan saved." />
      <PlanFields />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-4 py-2 text-sm font-medium"
        >
          Cancel
        </button>
        <SubmitButton pendingLabel="Saving…">Create plan</SubmitButton>
      </div>
    </form>
  )
}
