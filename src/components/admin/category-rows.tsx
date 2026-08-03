'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'

import { DeleteRowButton } from '@/components/admin/delete-row-button'
import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { deleteCategoryAction, saveCategoryAction } from '@/features/taxonomy/actions'

/**
 * Edit and delete a category in place (PRD 6.11).
 *
 * `saveCategoryAction` already updated when given an `id`; nothing sent one.
 * Same as the cities table — the server half of editing has been there since
 * Milestone 2.
 */

type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  active: boolean
  sort_order: number
  parent_id: string | null
}

export function CategoryRow({
  category,
  parents,
}: {
  category: Category
  parents: { id: string; name: string }[]
}) {
  const [editing, setEditing] = useState(false)
  const [state, action] = useAction(saveCategoryAction)

  // Adjusted during render rather than in an effect — React's documented way to
  // reset state in response to a change.
  const [lastState, setLastState] = useState(state)
  if (lastState !== state) {
    setLastState(state)
    if (state?.ok) setEditing(false)
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={5} className="bg-sand-50 px-4 py-4">
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={category.id} />
            <h3 className="text-sand-900 text-sm font-semibold">
              Editing {category.name}
              <span className="text-sand-600 ml-2 font-normal">
                Changing the slug leaves a 301 from the old URL.
              </span>
            </h3>
            <FormMessage state={state} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Name" error={fieldError(state, 'name')} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="name"
                    required
                    defaultValue={category.name}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>

              <Field label="Slug" error={fieldError(state, 'slug')} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="slug"
                    required
                    defaultValue={category.slug}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>

              <Field label="Parent category">
                {({ id }) => (
                  <select
                    id={id}
                    name="parentId"
                    defaultValue={category.parent_id ?? ''}
                    className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
                  >
                    <option value="">None (top level)</option>
                    {/* A category cannot be its own parent. */}
                    {parents
                      .filter((parent) => parent.id !== category.id)
                      .map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.name}
                        </option>
                      ))}
                  </select>
                )}
              </Field>

              <Field label="Sort order" error={fieldError(state, 'sortOrder')}>
                {({ id }) => (
                  <Input
                    id={id}
                    name="sortOrder"
                    type="number"
                    min={0}
                    defaultValue={category.sort_order}
                  />
                )}
              </Field>
            </div>

            <Field label="Description" error={fieldError(state, 'description')}>
              {({ id }) => (
                <Input id={id} name="description" defaultValue={category.description ?? ''} />
              )}
            </Field>

            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sand-700 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={category.active}
                  className="border-sand-400 size-4 rounded"
                />
                Visible to the public
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
      <td className="text-sand-900 px-4 py-3 font-medium">
        {category.parent_id ? <span className="text-sand-400">— </span> : null}
        {category.name}
      </td>
      <td className="text-sand-600 px-4 py-3 font-mono text-xs">{category.slug}</td>
      <td className="text-sand-700 px-4 py-3">{category.sort_order}</td>
      <td className="px-4 py-3">
        {category.active ? (
          <span className="text-[var(--color-success)]">yes</span>
        ) : (
          <span className="text-sand-500">hidden</span>
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
            Edit<span className="sr-only"> {category.name}</span>
          </button>
          <DeleteRowButton id={category.id} label={category.name} action={deleteCategoryAction} />
        </div>
      </td>
    </tr>
  )
}
