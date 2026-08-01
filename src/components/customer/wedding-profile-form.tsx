'use client'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { saveWeddingProfileAction } from '@/features/enquiries/actions'
import { minorToRupees } from '@/features/enquiries/schema'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

interface WeddingProfile {
  display_label: string | null
  wedding_date: string | null
  flexible_month: string | null
  primary_city_id: string | null
  budget_min_minor: number | null
  budget_max_minor: number | null
  guest_count: number | null
  notes: string | null
  wedding_required_categories?: { category_id: string }[] | null
}

/** Wedding profile (PRD 6.5). Everything is optional — this is planning
 * scaffolding, not a gate on using the marketplace. */
export function WeddingProfileForm({
  profile,
  cities,
  categories,
}: {
  profile: WeddingProfile | null
  cities: CityRow[]
  categories: CategoryRow[]
}) {
  const [state, action] = useAction(saveWeddingProfileAction)
  const required = new Set(
    (profile?.wedding_required_categories ?? []).map((row) => row.category_id),
  )

  return (
    <form
      action={action}
      className="border-sand-200 space-y-5 rounded-[var(--radius-card)] border bg-white p-5"
    >
      <FormMessage state={state} successMessage="Wedding profile saved." />

      <Field
        label="What should we call it?"
        hint="Just for you — e.g. “Ananya & Rohit” or “March wedding”."
        error={fieldError(state, 'displayLabel')}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="displayLabel"
            defaultValue={profile?.display_label ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Wedding date" hint="Leave empty if it is not fixed.">
          {({ id }) => (
            <Input
              id={id}
              name="weddingDate"
              type="date"
              defaultValue={profile?.wedding_date ?? ''}
            />
          )}
        </Field>
        <Field label="Or roughly which month?">
          {({ id }) => (
            <Input
              id={id}
              name="flexibleMonth"
              type="month"
              defaultValue={profile?.flexible_month ?? ''}
            />
          )}
        </Field>
      </div>

      <Field label="Main city">
        {({ id }) => (
          <select
            id={id}
            name="primaryCityId"
            defaultValue={profile?.primary_city_id ?? ''}
            className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">Not decided</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Budget from (₹)" error={fieldError(state, 'budgetMinMinor')}>
          {({ id }) => (
            <Input
              id={id}
              name="budgetMin"
              type="number"
              min={0}
              step={10000}
              defaultValue={minorToRupees(profile?.budget_min_minor) ?? ''}
            />
          )}
        </Field>
        <Field label="to (₹)" error={fieldError(state, 'budgetMaxMinor')}>
          {({ id }) => (
            <Input
              id={id}
              name="budgetMax"
              type="number"
              min={0}
              step={10000}
              defaultValue={minorToRupees(profile?.budget_max_minor) ?? ''}
            />
          )}
        </Field>
        <Field label="Guests" error={fieldError(state, 'guestCount')}>
          {({ id }) => (
            <Input
              id={id}
              name="guestCount"
              type="number"
              min={0}
              defaultValue={profile?.guest_count ?? ''}
            />
          )}
        </Field>
      </div>

      <fieldset>
        <legend className="text-sand-800 text-sm font-medium">What do you still need?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {categories.map((category) => (
            <label key={category.id} className="text-sand-700 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requiredCategoryIds"
                value={category.id}
                defaultChecked={required.has(category.id)}
                className="border-sand-400 size-4 rounded"
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Anything else?" hint="Private notes for yourself.">
        {({ id }) => (
          <Textarea id={id} name="notes" defaultValue={profile?.notes ?? ''} maxLength={2000} />
        )}
      </Field>

      <SubmitButton pendingLabel="Saving…">Save wedding profile</SubmitButton>
    </form>
  )
}
