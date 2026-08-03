'use client'

import { Plus } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { saveCategoryAction, saveCityAction } from '@/features/taxonomy/actions'
import { slugify } from '@/features/vendors/schema'
import { useState } from 'react'

/** Suggests a slug from the name, but leaves it editable before first save. */
function useSlugSuggestion(initial = '') {
  const [slug, setSlug] = useState(initial)
  const [touched, setTouched] = useState(Boolean(initial))
  return {
    slug,
    onNameChange: (value: string) => {
      if (!touched) setSlug(slugify(value))
    },
    onSlugChange: (value: string) => {
      setTouched(true)
      setSlug(value)
    },
  }
}

export function NewCategoryForm({ parents }: { parents: { id: string; name: string }[] }) {
  const [state, action] = useAction(saveCategoryAction)
  const suggestion = useSlugSuggestion()

  return (
    <form
      action={action}
      className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
    >
      <h2 className="font-display text-sand-900 text-lg">Add a category</h2>
      <FormMessage state={state} successMessage="Category saved." />

      <Field label="Name" error={fieldError(state, 'name')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="name"
            required
            onChange={(e) => suggestion.onNameChange(e.target.value)}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field
        label="Slug"
        hint="Used in the URL. Cannot be changed after saving."
        error={fieldError(state, 'slug')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="slug"
            required
            value={suggestion.slug}
            onChange={(e) => suggestion.onSlugChange(e.target.value)}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Description" error={fieldError(state, 'description')}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="description" aria-describedby={describedBy} invalid={invalid} />
        )}
      </Field>

      <Field label="Parent category" hint="Leave empty for a top-level category.">
        {({ id }) => (
          <select
            id={id}
            name="parentId"
            defaultValue=""
            className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sort order" error={fieldError(state, 'sortOrder')}>
          {({ id }) => <Input id={id} name="sortOrder" type="number" defaultValue={0} min={0} />}
        </Field>
        <label className="text-sand-700 flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked
            className="border-sand-400 size-4 rounded"
          />
          Visible to the public
        </label>
      </div>

      <SubmitButton pendingLabel="Saving…">
        <Plus aria-hidden="true" />
        Add category
      </SubmitButton>
    </form>
  )
}

export function NewCityForm({ states }: { states: { id: string; name: string }[] }) {
  const [state, action] = useAction(saveCityAction)
  const suggestion = useSlugSuggestion()

  return (
    <form
      action={action}
      className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
    >
      <h2 className="font-display text-sand-900 text-lg">Add a city</h2>
      <FormMessage state={state} successMessage="City saved." />

      <Field label="State" error={fieldError(state, 'stateId')} required>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="stateId"
            required
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">Choose a state</option>
            {states.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Name" error={fieldError(state, 'name')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="name"
            required
            onChange={(e) => suggestion.onNameChange(e.target.value)}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field
        label="Slug"
        hint="Used in the URL. Editable later — a rename leaves a 301 behind."
        error={fieldError(state, 'slug')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="slug"
            required
            value={suggestion.slug}
            onChange={(e) => suggestion.onSlugChange(e.target.value)}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sort order" error={fieldError(state, 'sortOrder')}>
          {({ id }) => <Input id={id} name="sortOrder" type="number" defaultValue={0} min={0} />}
        </Field>
        <label className="text-sand-700 flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked
            className="border-sand-400 size-4 rounded"
          />
          Visible to the public
        </label>
      </div>

      <SubmitButton pendingLabel="Saving…">
        <Plus aria-hidden="true" />
        Add city
      </SubmitButton>
    </form>
  )
}
