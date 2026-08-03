'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'

import { DeleteRowButton } from '@/components/admin/delete-row-button'
import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { deleteAttributeAction, saveAttributeAction } from '@/features/taxonomy/attribute-actions'

/**
 * Edit and delete an attribute definition (PRD 6.2).
 *
 * Deleting one also removes every answer vendors have given it — the FK from
 * `vendor_attribute_values` cascades, and that is the right behaviour, since a
 * question that no longer exists cannot have meaningful answers. What would not
 * be right is finding out afterwards, so the count is rendered from the server
 * and shown in the confirmation.
 */

type Attribute = {
  id: string
  categoryId: string
  code: string
  label: string
  inputType: string
  dataType: string
  unit: string | null
  filterable: boolean
  required: boolean
  options: string[]
  sortOrder: number
}

const INPUT_TYPES = ['text', 'number', 'select', 'multiselect', 'boolean', 'range'] as const
const DATA_TYPES = ['string', 'number', 'boolean', 'array'] as const

export function AttributeRow({
  attribute,
  categories,
  categoryName,
  answerCount,
}: {
  attribute: Attribute
  categories: { id: string; name: string }[]
  categoryName: string
  answerCount: number
}) {
  const [editing, setEditing] = useState(false)
  const [state, action] = useAction(saveAttributeAction)

  const [lastState, setLastState] = useState(state)
  if (lastState !== state) {
    setLastState(state)
    if (state?.ok) setEditing(false)
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={6} className="bg-sand-50 px-4 py-4">
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={attribute.id} />
            <h3 className="text-sand-900 text-sm font-semibold">Editing {attribute.label}</h3>
            <FormMessage state={state} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Category" error={fieldError(state, 'categoryId')} required>
                {({ id }) => (
                  <select
                    id={id}
                    name="categoryId"
                    required
                    defaultValue={attribute.categoryId}
                    className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <Field label="Label" error={fieldError(state, 'label')} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="label"
                    required
                    defaultValue={attribute.label}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>

              <Field label="Code" error={fieldError(state, 'code')} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="code"
                    required
                    defaultValue={attribute.code}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>

              <Field label="Input type" error={fieldError(state, 'inputType')} required>
                {({ id }) => (
                  <select
                    id={id}
                    name="inputType"
                    defaultValue={attribute.inputType}
                    className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
                  >
                    {INPUT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              {/*
                Stored values are matched on their JSON shape by
                `search_vendors`, so the data type is editable but visible —
                changing it on an attribute that already has answers leaves
                those answers the wrong shape.
              */}
              <Field
                label="Data type"
                hint={
                  answerCount > 0 ? `${answerCount} existing answers use this shape.` : undefined
                }
                error={fieldError(state, 'dataType')}
                required
              >
                {({ id }) => (
                  <select
                    id={id}
                    name="dataType"
                    defaultValue={attribute.dataType}
                    className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
                  >
                    {DATA_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <Field label="Unit" error={fieldError(state, 'unit')}>
                {({ id }) => <Input id={id} name="unit" defaultValue={attribute.unit ?? ''} />}
              </Field>
            </div>

            <Field label="Options" hint="One per line. Required for select and multiselect.">
              {({ id }) => (
                <textarea
                  id={id}
                  name="options"
                  rows={3}
                  defaultValue={attribute.options.join('\n')}
                  className="border-sand-300 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              )}
            </Field>

            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sand-700 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="filterable"
                  defaultChecked={attribute.filterable}
                  className="border-sand-400 size-4 rounded"
                />
                Filterable
              </label>
              <label className="text-sand-700 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="required"
                  defaultChecked={attribute.required}
                  className="border-sand-400 size-4 rounded"
                />
                Required
              </label>
              <label className="text-sand-700 flex items-center gap-2 text-sm">
                Sort order
                <Input
                  name="sortOrder"
                  type="number"
                  min={0}
                  defaultValue={attribute.sortOrder}
                  className="w-24"
                />
              </label>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
              </div>
            </div>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="text-sand-700 px-4 py-3">{categoryName}</td>
      <td className="text-sand-900 px-4 py-3 font-medium">{attribute.label}</td>
      <td className="text-sand-600 px-4 py-3 font-mono text-xs">{attribute.code}</td>
      <td className="text-sand-700 px-4 py-3">{attribute.inputType}</td>
      <td className="px-4 py-3">
        {attribute.filterable ? (
          <span className="text-[var(--color-success)]">yes</span>
        ) : (
          <span className="text-sand-500">no</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="border-sand-300 text-sand-700 hover:bg-sand-100 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
          >
            <Pencil aria-hidden="true" className="size-3" />
            Edit<span className="sr-only"> {attribute.label}</span>
          </button>
          <DeleteRowButton
            id={attribute.id}
            label={attribute.label}
            action={deleteAttributeAction}
            warning={
              answerCount > 0
                ? `This also removes ${answerCount} vendor ${answerCount === 1 ? 'answer' : 'answers'}.`
                : undefined
            }
          />
        </div>
      </td>
    </tr>
  )
}
