'use client'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { saveAdminVendorAction } from '@/features/admin/vendor-actions'
import type { CityRow } from '@/server/dal/taxonomy'

/**
 * Correcting a business's details on its behalf (PRD 6.11).
 *
 * The fields here are exactly the vendor's own — nothing that decides
 * publication, verification, plan, or placement. Those move through the
 * decision panel next to this one, which writes an audit entry; a text input
 * that quietly set `status` would leave no record of who published what.
 */
export function VendorEditForm({
  vendor,
  cities,
}: {
  vendor: {
    id: string
    displayName: string
    legalName: string | null
    slug: string
    primaryCityId: string | null
    cityName: string | null
    email: string | null
    phone: string | null
    website: string | null
    foundedYear: number | null
    about: string | null
  }
  cities: CityRow[]
}) {
  const [state, action] = useAction(saveAdminVendorAction)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="vendorId" value={vendor.id} />
      <FormMessage state={state} successMessage="Changes saved." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" error={fieldError(state, 'displayName')} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="displayName"
              required
              defaultValue={vendor.displayName}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Legal name" error={fieldError(state, 'legalName')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="legalName"
              defaultValue={vendor.legalName ?? ''}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field
          label="Web address"
          hint="Changing this leaves a 301 from the old URL."
          error={fieldError(state, 'slug')}
          required
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="slug"
              required
              defaultValue={vendor.slug}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Primary city" error={fieldError(state, 'primaryCityId')} required>
          {({ id, describedBy, invalid }) => (
            <select
              id={id}
              name="primaryCityId"
              required
              defaultValue={vendor.primaryCityId ?? ''}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
            >
              <option value="">Choose a city</option>
              {/*
                A business can sit in a city an admin has since hidden.
                `listCities` returns active ones only, so without this the
                select would silently drop the row's own value and reassign the
                business on save.
              */}
              {vendor.primaryCityId && !cities.some((c) => c.id === vendor.primaryCityId) ? (
                <option value={vendor.primaryCityId}>{vendor.cityName ?? 'Current city'}</option>
              ) : null}
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Contact email" error={fieldError(state, 'email')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="email"
              type="email"
              defaultValue={vendor.email ?? ''}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Contact phone" error={fieldError(state, 'phone')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="phone"
              defaultValue={vendor.phone ?? ''}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Website" error={fieldError(state, 'website')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="website"
              type="url"
              placeholder="https://"
              defaultValue={vendor.website ?? ''}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Founded" error={fieldError(state, 'foundedYear')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="foundedYear"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              defaultValue={vendor.foundedYear ?? ''}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>

      <Field
        label="About"
        hint="At least 50 characters, or leave it empty. Shown on the public profile once approved."
        error={fieldError(state, 'about')}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="about"
            rows={6}
            maxLength={4000}
            defaultValue={vendor.about ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  )
}
