'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { saveAttributeAction } from '@/features/taxonomy/attribute-actions'

/**
 * Input type and data type are related but not identical — a `multiselect`
 * stores an array, a `select` stores a string. Picking the input type sets a
 * sensible data type so the two cannot drift, which matters because
 * `search_vendors` matches on the stored shape.
 */
const INPUT_TYPES = [
  { value: 'text', label: 'Text', dataType: 'string', hasOptions: false },
  { value: 'number', label: 'Number', dataType: 'number', hasOptions: false },
  { value: 'boolean', label: 'Yes / no', dataType: 'boolean', hasOptions: false },
  { value: 'select', label: 'Choose one', dataType: 'string', hasOptions: true },
  { value: 'multiselect', label: 'Choose several', dataType: 'array', hasOptions: true },
] as const

export function AttributeDefinitionForm({
  categories,
}: {
  categories: { id: string; name: string }[]
}) {
  const [state, action] = useAction(saveAttributeAction)
  const [inputType, setInputType] = useState<(typeof INPUT_TYPES)[number]['value']>('select')

  const current = INPUT_TYPES.find((t) => t.value === inputType)!

  return (
    <form
      action={action}
      className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
    >
      <h2 className="font-display text-sand-900 text-lg">Add an attribute</h2>
      <FormMessage state={state} successMessage="Attribute saved." />

      <Field label="Category" error={fieldError(state, 'categoryId')} required>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="categoryId"
            required
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        label="Label"
        hint="What vendors and couples see."
        error={fieldError(state, 'label')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="label"
            required
            placeholder="e.g. Guest capacity"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field
        label="Code"
        hint="Used in filter URLs. Lowercase, no spaces. Cannot be changed later."
        error={fieldError(state, 'code')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="code"
            required
            placeholder="e.g. capacity"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Answer type" required>
        {({ id }) => (
          <select
            id={id}
            name="inputType"
            value={inputType}
            onChange={(event) => setInputType(event.target.value as typeof inputType)}
            className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            {INPUT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      {/* Derived, not chosen — keeps the stored shape and the search matcher aligned. */}
      <input type="hidden" name="dataType" value={current.dataType} />

      {current.hasOptions ? (
        <Field label="Options" hint="One per line." error={fieldError(state, 'options')} required>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              name="options"
              required
              placeholder={'Banquet hall\nHotel\nResort'}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      ) : null}

      {current.dataType === 'number' ? (
        <Field label="Unit" hint="e.g. guests, rooms, INR.">
          {({ id }) => <Input id={id} name="unit" />}
        </Field>
      ) : null}

      <div className="space-y-2">
        <label className="text-sand-700 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="filterable"
            defaultChecked
            className="border-sand-400 size-4 rounded"
          />
          Show as a search filter
        </label>
        <label className="text-sand-700 flex items-center gap-2 text-sm">
          <input type="checkbox" name="required" className="border-sand-400 size-4 rounded" />
          Vendors must answer this
        </label>
      </div>

      <Field label="Order">
        {({ id }) => (
          <Input id={id} name="sortOrder" type="number" min={0} defaultValue={0} className="w-24" />
        )}
      </Field>

      <SubmitButton pendingLabel="Saving…">
        <Plus aria-hidden="true" />
        Add attribute
      </SubmitButton>
    </form>
  )
}
