'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import type { ActionResult } from '@/lib/action-result'
import { SubmitButton } from '@/components/shared/submit-button'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { deletePackageAction, savePackageAction } from '@/features/listings/actions'
import { PRICE_TYPES, type PriceType } from '@/features/listings/schema'
import { formatRange, money, toMajor } from '@/lib/money'
import type { CategoryRow } from '@/server/dal/taxonomy'
import type { VendorPackageRow } from '@/server/dal/listings'

const CARD = 'rounded-[var(--radius-card)] border border-sand-200 bg-white p-5'

function priceLabel(pkg: VendorPackageRow): string {
  if (pkg.priceType === 'custom') return 'On request'
  const label = formatRange(
    pkg.minAmountMinor ? money(pkg.minAmountMinor, pkg.currency) : null,
    pkg.maxAmountMinor ? money(pkg.maxAmountMinor, pkg.currency) : null,
  )
  if (!label) return 'On request'
  return pkg.priceType === 'starting_at' ? `From ${label}` : label
}

/** Price fields depend on the price type: a range needs two, "on request"
 * needs none. Rendering all of them always would invite invalid combinations. */
function PriceFields({
  priceType,
  pkg,
  state,
}: {
  priceType: PriceType
  pkg?: VendorPackageRow
  state: ActionResult<{ id: string }> | null
}) {
  if (priceType === 'custom') {
    return (
      <p className="text-sand-600 text-sm">No price shown. Couples will see “Price on request”.</p>
    )
  }

  const minMajor = pkg?.minAmountMinor
    ? toMajor(money(pkg.minAmountMinor, pkg.currency))
    : undefined
  const maxMajor = pkg?.maxAmountMinor
    ? toMajor(money(pkg.maxAmountMinor, pkg.currency))
    : undefined

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={priceType === 'range' ? 'Lowest price' : 'Price'}
        hint="In rupees."
        error={fieldError(state, 'minAmount')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="minAmount"
            type="number"
            min={0}
            step={1}
            defaultValue={minMajor}
            required
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      {priceType === 'range' ? (
        <Field label="Highest price" error={fieldError(state, 'maxAmount')} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="maxAmount"
              type="number"
              min={0}
              step={1}
              defaultValue={maxMajor}
              required
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      ) : null}
    </div>
  )
}

function PackageForm({
  vendorId,
  categories,
  pkg,
  onDone,
}: {
  vendorId: string
  categories: CategoryRow[]
  pkg?: VendorPackageRow
  onDone?: () => void
}) {
  const [state, action] = useAction(savePackageAction)
  const [priceType, setPriceType] = useState<PriceType>(
    (pkg?.priceType as PriceType) ?? 'starting_at',
  )

  // Closing the editor after a successful save is a side effect; doing it
  // during render would update a parent mid-render and React would throw.
  useEffect(() => {
    if (state?.ok) onDone?.()
  }, [state, onDone])

  return (
    <form action={action} className={`${CARD} space-y-4`}>
      <h3 className="font-display text-sand-900 text-lg">
        {pkg ? 'Edit package' : 'Add a package'}
      </h3>
      <input type="hidden" name="vendorId" value={vendorId} />
      {pkg ? <input type="hidden" name="id" value={pkg.id} /> : null}
      <input type="hidden" name="currency" value={pkg?.currency ?? 'INR'} />
      <FormMessage state={state} successMessage="Package saved." />

      <Field label="Package name" error={fieldError(state, 'name')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="name"
            defaultValue={pkg?.name}
            required
            placeholder="e.g. Single day coverage"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="What it covers" error={fieldError(state, 'description')}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="description"
            defaultValue={pkg?.description ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="How is it priced?" required>
        {({ id }) => (
          <select
            id={id}
            name="priceType"
            value={priceType}
            onChange={(event) => setPriceType(event.target.value as PriceType)}
            className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            {PRICE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <PriceFields priceType={priceType} pkg={pkg} state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Per" hint="e.g. plate, day, function. Leave empty for a whole event.">
          {({ id }) => <Input id={id} name="unit" defaultValue={pkg?.unit ?? ''} />}
        </Field>
        <Field label="Category" hint="Optional, when a package belongs to one service.">
          {({ id }) => (
            <select
              id={id}
              name="categoryId"
              defaultValue={pkg?.categoryId ?? ''}
              className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
            >
              <option value="">All services</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Included" hint="One per line.">
          {({ id }) => (
            <Textarea id={id} name="inclusions" defaultValue={pkg?.inclusions.join('\n') ?? ''} />
          )}
        </Field>
        <Field label="Not included" hint="One per line.">
          {({ id }) => (
            <Textarea id={id} name="exclusions" defaultValue={pkg?.exclusions.join('\n') ?? ''} />
          )}
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sand-700 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={pkg?.active ?? true}
            className="border-sand-400 size-4 rounded"
          />
          Show this package publicly
        </label>
        <Field label="Order">
          {({ id }) => (
            <Input
              id={id}
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={pkg?.sortOrder ?? 0}
              className="w-24"
            />
          )}
        </Field>
      </div>

      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">{pkg ? 'Save changes' : 'Add package'}</SubmitButton>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}

export function PackageManager({
  vendorId,
  packages,
  categories,
  readOnly,
}: {
  vendorId: string
  packages: VendorPackageRow[]
  categories: CategoryRow[]
  readOnly: boolean
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleteState, remove] = useAction(deletePackageAction)

  return (
    <div className="space-y-4">
      <FormMessage state={deleteState} successMessage="Package removed." />

      {packages.length === 0 ? (
        <p className="border-sand-300 text-sand-600 rounded-[var(--radius-card)] border border-dashed bg-white p-6 text-center text-sm">
          No packages yet. Listings with clear pricing receive noticeably more enquiries.
        </p>
      ) : (
        <ul className="space-y-3">
          {packages.map((pkg) =>
            editing === pkg.id ? (
              <li key={pkg.id}>
                <PackageForm
                  vendorId={vendorId}
                  categories={categories}
                  pkg={pkg}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={pkg.id} className={CARD}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sand-900 font-medium">
                    {pkg.name}
                    {!pkg.active ? (
                      <span className="bg-sand-100 text-sand-600 ml-2 rounded-full px-2 py-0.5 text-xs">
                        hidden
                      </span>
                    ) : null}
                  </h3>
                  <p className="text-brand-700 text-sm font-medium">
                    {priceLabel(pkg)}
                    {pkg.unit ? <span className="text-sand-500"> / {pkg.unit}</span> : null}
                  </p>
                </div>
                {pkg.description ? (
                  <p className="text-sand-600 mt-1 text-sm">{pkg.description}</p>
                ) : null}
                {pkg.inclusions.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {pkg.inclusions.map((item) => (
                      <li
                        key={item}
                        className="bg-sand-100 text-sand-700 rounded-full px-2 py-0.5 text-xs"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!readOnly ? (
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(pkg.id)}>
                      Edit
                    </Button>
                    <form action={remove}>
                      <input type="hidden" name="vendorId" value={vendorId} />
                      <input type="hidden" name="packageId" value={pkg.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${pkg.name}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}

      {!readOnly ? (
        adding ? (
          <PackageForm
            vendorId={vendorId}
            categories={categories}
            onDone={() => setAdding(false)}
          />
        ) : (
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add a package
          </Button>
        )
      ) : null}
    </div>
  )
}
