'use client'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { registerVendorAndCreateAccount } from '@/features/vendors/actions'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

/**
 * Fills all hidden inputs so registerVendorAndCreateAccount gets the complete
 * dataset in one submit. Used by the server-rendered registration page.
 */
export function RegisterVendorForm({
  categories,
  cities,
}: {
  categories: CategoryRow[]
  cities: CityRow[]
}) {
  const [state, formAction] = useAction(registerVendorAndCreateAccount)

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      {/* Account fields */}
      <div className="space-y-4">
        <AccountField label="Your name" name="fullName" required autoComplete="name" error={fieldError(state, 'fullName')} />
        <AccountField label="Email" name="email" type="email" required autoComplete="email" error={fieldError(state, 'email')} />
        <AccountField
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          hint="At least 10 characters, including a letter and a number."
          error={fieldError(state, 'password')}
        />

        <label className="flex items-start gap-2 text-sm text-sand-700">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="border-sand-400 mt-0.5 size-4 rounded"
          />
          <span>
            I accept the{' '}
            <a href="/terms" className="text-brand-700 hover:underline">terms</a> and{' '}
            <a href="/privacy" className="text-brand-700 hover:underline">privacy policy</a>.
          </span>
        </label>
      </div>

      {/* Business fields */}
      <div className="border-sand-200 space-y-4 border-t pt-4">
        <BusinessField
          label="Business name"
          name="displayName"
          required
          placeholder="e.g. Marigold Courtyard"
          error={fieldError(state, 'displayName')}
        />

        <div>
          <label className="text-sand-800 text-sm font-medium">
            What do you offer? <span className="text-[var(--color-danger)]">*</span>
          </label>
          <select
            name="primaryCategoryId"
            required
            className={`border-sand-300 mt-1.5 h-11 w-full rounded-lg border bg-white px-3 text-sm ${fieldError(state, 'primaryCategoryId') ? 'border-[var(--color-danger)]' : ''}`}
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {fieldError(state, 'primaryCategoryId') && (
            <p className="text-[var(--color-danger)] mt-1 text-xs">{fieldError(state, 'primaryCategoryId')}</p>
          )}
        </div>

        <div>
          <label className="text-sand-800 text-sm font-medium">
            Where are you based? <span className="text-[var(--color-danger)]">*</span>
          </label>
          <select
            name="primaryCityId"
            required
            className={`border-sand-300 mt-1.5 h-11 w-full rounded-lg border bg-white px-3 text-sm ${fieldError(state, 'primaryCityId') ? 'border-[var(--color-danger)]' : ''}`}
          >
            <option value="">Choose a city</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          {fieldError(state, 'primaryCityId') && (
            <p className="text-[var(--color-danger)] mt-1 text-xs">{fieldError(state, 'primaryCityId')}</p>
          )}
        </div>
      </div>

      <SubmitButton className="w-full" pendingLabel="Creating your account…">
        Create account &amp; start listing
      </SubmitButton>

      <p className="text-sand-500 text-xs">
        Nothing is published until you submit for review and our team approves it.
      </p>
    </form>
  )
}

function AccountField({
  label,
  name,
  type = 'text',
  required,
  hint,
  placeholder,
  autoComplete,
  error,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  hint?: string
  placeholder?: string
  autoComplete?: string
  error?: string
}) {
  return (
    <div>
      <label className="text-sand-800 text-sm font-medium">
        {label} {required && <span className="text-[var(--color-danger)]">*</span>}
      </label>
      {hint && <p className="text-sand-500 mt-0.5 text-xs">{hint}</p>}
      <input
        type={type}
        name={name}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        className={`border-sand-300 mt-1.5 h-11 w-full rounded-lg border bg-white px-3 text-sm ${error ? 'border-[var(--color-danger)]' : ''}`}
      />
      {error && <p className="text-[var(--color-danger)] mt-1 text-xs">{error}</p>}
    </div>
  )
}

function BusinessField({
  label,
  name,
  required,
  placeholder,
  error,
}: {
  label: string
  name: string
  required?: boolean
  placeholder?: string
  error?: string
}) {
  return (
    <div>
      <label className="text-sand-800 text-sm font-medium">
        {label} {required && <span className="text-[var(--color-danger)]">*</span>}
      </label>
      <input
        type="text"
        name={name}
        required={required}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        className={`border-sand-300 mt-1.5 h-11 w-full rounded-lg border bg-white px-3 text-sm ${error ? 'border-[var(--color-danger)]' : ''}`}
      />
      {error && <p className="text-[var(--color-danger)] mt-1 text-xs">{error}</p>}
    </div>
  )
}
