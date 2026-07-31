'use client'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { saveAttributeValuesAction } from '@/features/taxonomy/attribute-actions'
import type { AttributeDefinition } from '@/server/dal/taxonomy'

/**
 * The vendor's answers to their categories' attributes (PRD 6.2). These are
 * what category-specific search filters match against, so the copy explains
 * why answering matters.
 */
export function AttributeForm({
  vendorId,
  attributes,
  values,
  readOnly,
}: {
  vendorId: string
  attributes: AttributeDefinition[]
  values: Record<string, unknown>
  readOnly: boolean
}) {
  const [state, action] = useAction(saveAttributeValuesAction)

  if (attributes.length === 0) {
    return (
      <p className="border-sand-300 text-sand-600 rounded-[var(--radius-card)] border border-dashed bg-white p-6 text-center text-sm">
        No questions have been set up for your categories yet.
      </p>
    )
  }

  return (
    <form
      action={action}
      className="border-sand-200 space-y-5 rounded-[var(--radius-card)] border bg-white p-5"
    >
      <input type="hidden" name="vendorId" value={vendorId} />
      <FormMessage state={state} successMessage="Your answers were saved." />

      {attributes.map((attribute) => {
        const field = `attr__${attribute.id}`
        const value = values[attribute.id]
        const label = attribute.unit ? `${attribute.label} (${attribute.unit})` : attribute.label

        if (attribute.inputType === 'boolean') {
          return (
            <div key={attribute.id} className="space-y-1">
              {/* Marks the field as submitted so an unchecked box is stored as
                  a real "no" rather than treated as unanswered. */}
              <input type="hidden" name={`${field}__present`} value="1" />
              <label className="text-sand-800 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={field}
                  defaultChecked={value === true}
                  disabled={readOnly}
                  className="border-sand-400 size-4 rounded"
                />
                {label}
              </label>
              {attribute.helpText ? (
                <p className="text-sand-500 text-xs">{attribute.helpText}</p>
              ) : null}
            </div>
          )
        }

        if (attribute.inputType === 'multiselect') {
          const selected = Array.isArray(value) ? (value as string[]) : []
          return (
            <fieldset key={attribute.id} disabled={readOnly}>
              <legend className="text-sand-800 text-sm font-medium">{label}</legend>
              {attribute.helpText ? (
                <p className="text-sand-500 mt-0.5 text-xs">{attribute.helpText}</p>
              ) : null}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {attribute.options.map((option) => (
                  <label key={option} className="text-sand-700 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={field}
                      value={option}
                      defaultChecked={selected.includes(option)}
                      className="border-sand-400 size-4 rounded"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          )
        }

        if (attribute.inputType === 'select') {
          return (
            <Field key={attribute.id} label={label} hint={attribute.helpText ?? undefined}>
              {({ id }) => (
                <select
                  id={id}
                  name={field}
                  defaultValue={typeof value === 'string' ? value : ''}
                  disabled={readOnly}
                  className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
                >
                  <option value="">No answer</option>
                  {attribute.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )
        }

        return (
          <Field key={attribute.id} label={label} hint={attribute.helpText ?? undefined}>
            {({ id }) => (
              <Input
                id={id}
                name={field}
                type={attribute.dataType === 'number' ? 'number' : 'text'}
                min={attribute.dataType === 'number' ? 0 : undefined}
                defaultValue={
                  typeof value === 'string' || typeof value === 'number' ? String(value) : ''
                }
                disabled={readOnly}
              />
            )}
          </Field>
        )
      })}

      {!readOnly ? <SubmitButton pendingLabel="Saving…">Save answers</SubmitButton> : null}
    </form>
  )
}
