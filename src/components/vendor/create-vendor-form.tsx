'use client'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { createVendorAction } from '@/features/vendors/actions'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

/** Step one of onboarding (PRD 6.4). Deliberately three fields — everything
 * else is collected after the workspace exists, so progress is never lost. */
export function CreateVendorForm({
  categories,
  cities,
}: {
  categories: CategoryRow[]
  cities: CityRow[]
}) {
  const [state, action] = useAction(createVendorAction)

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />

      <Field label="Business name" error={fieldError(state, 'displayName')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="displayName"
            required
            autoComplete="organization"
            placeholder="e.g. Marigold Courtyard"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="What do you offer?" error={fieldError(state, 'primaryCategoryId')} required>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="primaryCategoryId"
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

      <Field label="Where are you based?" error={fieldError(state, 'primaryCityId')} required>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="primaryCityId"
            required
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">Choose a city</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <SubmitButton className="w-full" pendingLabel="Creating…">
        Create my business profile
      </SubmitButton>

      <p className="text-sand-500 text-xs">
        Nothing is published until you submit for review and our team approves it.
      </p>
    </form>
  )
}
