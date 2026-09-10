'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, Image as ImageIcon } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { createAdminVendorAction } from '@/features/admin/vendor-actions'
import { slugify } from '@/features/vendors/schema'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

/**
 * Creating a business from the admin panel (migration 0039).
 *
 * For the cases the self-serve wizard does not cover: a business signed up over
 * the phone, at a wedding fair, or by a salesperson sitting next to the owner.
 * The panel could already approve, edit, suspend and delete a business; this is
 * the one thing it could not do.
 *
 * Two decisions are visible in the form rather than buried in the server:
 *
 * - **Publish now** puts the listing live without the review queue. The label
 *   says exactly that, and says it does *not* grant the verified badge, because
 *   "live" and "verified" being the same thing is the misunderstanding worth
 *   preventing.
 * - **Owner email** decides who ends up holding it. Blank means the creating
 *   admin does, so the listing stays editable through the normal vendor screens
 *   until it is handed over.
 */
export function VendorCreateForm({
  categories,
  cities,
}: {
  categories: CategoryRow[]
  cities: CityRow[]
}) {
  const [state, action] = useAction(createAdminVendorAction)

  /*
   * The slug follows the name until an admin types in it, then stops.
   *
   * Controlled rather than a one-shot `defaultValue`, because the name is the
   * first field filled and a slug derived once on mount would always be empty.
   * `touched` is what stops it overwriting a deliberate choice on the next
   * keystroke in the name.
   */
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [publish, setPublish] = useState(false)

  if (state?.ok) {
    const { vendorId, slug: created, status, ownerIsCreator } = state.data
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg bg-[color-mix(in_oklch,var(--color-success)_12%,white)] px-3 py-2 text-sm text-[var(--color-success)]"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Business created.{' '}
            {status === 'active'
              ? 'It is live now — couples can find it in search.'
              : 'It is saved as a draft and is not public yet.'}
          </span>
        </p>

        <ul className="border-sand-200 divide-sand-200 divide-y rounded-[var(--radius-card)] border bg-white text-sm">
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sand-700">Status</span>
            <span className="text-sand-900 font-medium">{status}</span>
          </li>
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sand-700">Verification</span>
            {/*
              Stated plainly on the success screen, not only in the form's help
              text. Publishing straight past the queue is exactly when someone
              would assume the badge came with it.
            */}
            <span className="text-sand-900 font-medium">
              unverified — documents and an Approve still required
            </span>
          </li>
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sand-700">Owner</span>
            <span className="text-sand-900 font-medium">
              {ownerIsCreator ? 'You, until it is handed over' : 'The account you named'}
            </span>
          </li>
        </ul>

        {/*
          The photographs are the point of the next step, so it is the primary
          button rather than a link buried on the business page. This form takes
          a name, a category and a description; a listing with none of a
          business's work on it is not one a couple will enquire from, and the
          moment an admin has just typed the details is the moment they still
          have the photographs to hand.
        */}
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/admin/vendors/${vendorId}/listing`}
            className="bg-brand-700 inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium text-white"
          >
            <ImageIcon aria-hidden="true" className="size-4" />
            Add photos and finish the listing
          </Link>
          <Link
            href={`/admin/vendors/${vendorId}`}
            className="border-sand-300 text-sand-900 inline-flex min-h-11 items-center gap-2 rounded-lg border bg-white px-5 text-sm font-medium"
          >
            Open the business
          </Link>
          {status === 'active' ? (
            <Link
              href={`/vendor/${created}`}
              className="border-sand-300 text-sand-900 inline-flex min-h-11 items-center gap-2 rounded-lg border bg-white px-5 text-sm font-medium"
            >
              View public profile
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </Link>
          ) : null}
          <Link
            href="/admin/vendors/new"
            className="text-sand-700 hover:bg-sand-100 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium"
          >
            Add another
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" error={fieldError(state, 'displayName')} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="displayName"
              required
              aria-describedby={describedBy}
              invalid={invalid}
              onChange={(event) => {
                if (!slugTouched) setSlug(slugify(event.target.value))
              }}
            />
          )}
        </Field>

        <Field
          label="Web address"
          hint="Appears as /vendor/… — lowercase letters, numbers and hyphens."
          error={fieldError(state, 'slug')}
          required
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="slug"
              required
              value={slug}
              onChange={(event) => {
                setSlugTouched(true)
                setSlug(event.target.value)
              }}
              aria-describedby={describedBy}
              invalid={invalid}
              className="font-mono"
            />
          )}
        </Field>

        <Field label="Primary category" error={fieldError(state, 'primaryCategoryId')} required>
          {({ id, describedBy, invalid }) => (
            <select
              id={id}
              name="primaryCategoryId"
              required
              defaultValue=""
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
          label="Primary city"
          hint="Also added as the first area the business covers."
          error={fieldError(state, 'primaryCityId')}
          required
        >
          {({ id, describedBy, invalid }) => (
            <select
              id={id}
              name="primaryCityId"
              required
              defaultValue=""
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

        <Field label="Contact email" error={fieldError(state, 'email')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="email"
              type="email"
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Contact phone" error={fieldError(state, 'phone')}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="phone" aria-describedby={describedBy} invalid={invalid} />
          )}
        </Field>

        <Field label="Website" error={fieldError(state, 'website')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="website"
              type="url"
              placeholder="https://"
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field
          label="Owner's account email"
          hint="Leave blank to hold it yourself. The account must already exist."
          error={fieldError(state, 'ownerEmail')}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="ownerEmail"
              type="email"
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>

      <Field
        label="Description"
        hint={
          publish
            ? 'Required to publish — at least 50 characters. This is what couples read.'
            : 'Optional for a draft. Needed before it can go live.'
        }
        error={fieldError(state, 'about')}
        required={publish}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="about"
            rows={6}
            maxLength={4000}
            required={publish}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="publish"
            checked={publish}
            onChange={(event) => setPublish(event.target.checked)}
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="text-sm">
            <span className="text-sand-900 block font-medium">Publish immediately</span>
            <span className="text-sand-600 mt-0.5 block">
              Goes live without the review queue — couples can find it as soon as you save. It is
              still <strong>unverified</strong>: the badge needs documents and an Approve, and this
              does not grant it.
            </span>
          </span>
        </label>
      </div>

      <SubmitButton pendingLabel="Creating…">
        {publish ? 'Create and publish' : 'Create as draft'}
      </SubmitButton>
    </form>
  )
}
