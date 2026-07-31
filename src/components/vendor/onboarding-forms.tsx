'use client'

import { Trash2, Upload } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import {
  deleteDocumentAction,
  saveCategoriesAction,
  saveListingAction,
  saveProfileAction,
  saveServiceAreasAction,
  submitForReviewAction,
  uploadDocumentAction,
} from '@/features/vendors/actions'
import { DOCUMENT_KINDS } from '@/features/vendors/schema'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'
import type { VendorWorkspace, VerificationDocument } from '@/server/dal/vendor-workspace'
import { formatDate } from '@/lib/dates'

const SECTION = 'rounded-[var(--radius-card)] border border-sand-200 bg-white p-5 space-y-4'

export function BusinessDetailsForm({
  vendor,
  cities,
  readOnly,
}: {
  vendor: VendorWorkspace
  cities: CityRow[]
  readOnly: boolean
}) {
  const [state, action] = useAction(saveProfileAction)

  return (
    <form action={action} className={SECTION}>
      <h2 className="font-display text-sand-900 text-lg">Business details</h2>
      <input type="hidden" name="vendorId" value={vendor.id} />
      <FormMessage state={state} successMessage="Business details saved." />

      <Field label="Business name" error={fieldError(state, 'displayName')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="displayName"
            defaultValue={vendor.displayName}
            required
            disabled={readOnly}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field
        label="Registered legal name"
        hint="Only used for verification. Never shown publicly."
        error={fieldError(state, 'legalName')}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="legalName"
            defaultValue={vendor.legalName ?? ''}
            disabled={readOnly}
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
            defaultValue={vendor.primaryCityId ?? ''}
            required
            disabled={readOnly}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Contact email"
          hint="Where enquiry alerts go. Not public."
          error={fieldError(state, 'email')}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="email"
              type="email"
              defaultValue={vendor.email ?? ''}
              disabled={readOnly}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Contact phone" hint="Not public." error={fieldError(state, 'phone')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="phone"
              type="tel"
              defaultValue={vendor.phone ?? ''}
              disabled={readOnly}
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
              disabled={readOnly}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Year founded" error={fieldError(state, 'foundedYear')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="foundedYear"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              defaultValue={vendor.foundedYear ?? ''}
              disabled={readOnly}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>

      {!readOnly ? <SubmitButton pendingLabel="Saving…">Save details</SubmitButton> : null}
    </form>
  )
}

export function ListingForm({ vendor, readOnly }: { vendor: VendorWorkspace; readOnly: boolean }) {
  const [state, action] = useAction(saveListingAction)

  return (
    <form action={action} className={SECTION}>
      <h2 className="font-display text-sand-900 text-lg">About your business</h2>
      <input type="hidden" name="vendorId" value={vendor.id} />
      <FormMessage state={state} successMessage="Listing saved." />

      <Field
        label="Description"
        hint="At least 50 characters. This is the first thing couples read."
        error={fieldError(state, 'about')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="about"
            defaultValue={vendor.about ?? ''}
            minLength={50}
            maxLength={4000}
            required
            disabled={readOnly}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Years in business" error={fieldError(state, 'experienceYears')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="experienceYears"
            type="number"
            min={0}
            defaultValue={vendor.experienceYears ?? ''}
            disabled={readOnly}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      {!readOnly ? <SubmitButton pendingLabel="Saving…">Save description</SubmitButton> : null}
    </form>
  )
}

export function CategoriesForm({
  vendor,
  categories,
  readOnly,
}: {
  vendor: VendorWorkspace
  categories: CategoryRow[]
  readOnly: boolean
}) {
  const [state, action] = useAction(saveCategoriesAction)

  return (
    <form action={action} className={SECTION}>
      <h2 className="font-display text-sand-900 text-lg">Categories</h2>
      <input type="hidden" name="vendorId" value={vendor.id} />
      <FormMessage state={state} successMessage="Categories saved." />

      <Field label="Primary category" error={fieldError(state, 'primaryCategoryId')} required>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="primaryCategoryId"
            defaultValue={vendor.primaryCategoryId ?? ''}
            required
            disabled={readOnly}
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

      <fieldset disabled={readOnly}>
        <legend className="text-sand-800 text-sm font-medium">Also appears in</legend>
        <p className="text-sand-600 mt-1 mb-2 text-xs">Optional. Up to five more categories.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((category) => (
            <label key={category.id} className="text-sand-700 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="additionalCategoryIds"
                value={category.id}
                defaultChecked={
                  vendor.categoryIds.includes(category.id) &&
                  category.id !== vendor.primaryCategoryId
                }
                className="border-sand-400 size-4 rounded"
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      {!readOnly ? <SubmitButton pendingLabel="Saving…">Save categories</SubmitButton> : null}
    </form>
  )
}

export function ServiceAreasForm({
  vendor,
  cities,
  readOnly,
}: {
  vendor: VendorWorkspace
  cities: CityRow[]
  readOnly: boolean
}) {
  const [state, action] = useAction(saveServiceAreasAction)

  return (
    <form action={action} className={SECTION}>
      <h2 className="font-display text-sand-900 text-lg">Service areas</h2>
      <input type="hidden" name="vendorId" value={vendor.id} />
      <FormMessage state={state} successMessage="Service areas saved." />

      <fieldset disabled={readOnly}>
        <legend className="text-sand-800 text-sm font-medium">
          Cities you work in <span className="text-[var(--color-danger)]">*</span>
        </legend>
        {fieldError(state, 'cityIds') ? (
          <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
            {fieldError(state, 'cityIds')}
          </p>
        ) : null}
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {cities.map((city) => (
            <label key={city.id} className="text-sand-700 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="cityIds"
                value={city.id}
                defaultChecked={vendor.serviceAreaCityIds.includes(city.id)}
                className="border-sand-400 size-4 rounded"
              />
              {city.name}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="text-sand-700 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="travelAvailable"
          disabled={readOnly}
          className="border-sand-400 size-4 rounded"
        />
        I travel to other cities on request
      </label>

      {!readOnly ? <SubmitButton pendingLabel="Saving…">Save service areas</SubmitButton> : null}
    </form>
  )
}

export function DocumentsSection({
  vendor,
  documents,
  readOnly,
}: {
  vendor: VendorWorkspace
  documents: VerificationDocument[]
  readOnly: boolean
}) {
  const [uploadState, upload] = useAction(uploadDocumentAction)
  const [deleteState, remove] = useAction(deleteDocumentAction)

  return (
    <div className={SECTION}>
      <div>
        <h2 className="font-display text-sand-900 text-lg">Verification documents</h2>
        <p className="text-sand-600 mt-1 text-sm">
          Stored privately. Only you and our verification team can open these — they are never shown
          on your public profile.
        </p>
      </div>

      <FormMessage state={uploadState} successMessage="Document uploaded." />
      <FormMessage state={deleteState} successMessage="Document removed." />

      {documents.length > 0 ? (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-lg border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="text-sand-900 font-medium">
                  {DOCUMENT_KINDS.find((k) => k.value === doc.documentType)?.label ??
                    doc.documentType}
                </p>
                <p className="text-sand-500 text-xs">Uploaded {formatDate(doc.createdAt)}</p>
              </div>
              {!readOnly ? (
                <form action={remove}>
                  <input type="hidden" name="documentId" value={doc.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${doc.documentType}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-sand-300 text-sand-600 rounded-lg border border-dashed p-4 text-sm">
          No documents uploaded yet.
        </p>
      )}

      {!readOnly ? (
        <form action={upload} className="border-sand-200 space-y-3 border-t pt-4">
          <input type="hidden" name="vendorId" value={vendor.id} />

          <Field label="Document type" error={fieldError(uploadState, 'documentType')} required>
            {({ id }) => (
              <select
                id={id}
                name="documentType"
                required
                className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
              >
                {DOCUMENT_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="File" hint="PDF, JPEG, or PNG. Up to 10 MB." required>
            {({ id }) => (
              <input
                id={id}
                name="file"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                required
                className="text-sand-700 file:bg-sand-100 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
              />
            )}
          </Field>

          <SubmitButton pendingLabel="Uploading…">
            <Upload aria-hidden="true" />
            Upload document
          </SubmitButton>
        </form>
      ) : null}
    </div>
  )
}

export function SubmitForReviewCard({ vendor }: { vendor: VendorWorkspace }) {
  const [state, action] = useAction(submitForReviewAction)
  const blocked = vendor.completion.missingRequired

  return (
    <form action={action} className={SECTION}>
      <h2 className="font-display text-sand-900 text-lg">Submit for review</h2>
      <FormMessage state={state} successMessage="Submitted. We will be in touch shortly." />
      <input type="hidden" name="vendorId" value={vendor.id} />

      {blocked.length > 0 ? (
        <div className="bg-sand-50 rounded-lg p-3 text-sm">
          <p className="text-sand-900 font-medium">Before you can submit, add:</p>
          <ul className="text-sand-700 mt-1 list-inside list-disc">
            {blocked.map((field) => (
              <li key={field.key}>{field.label}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sand-600 text-sm">
          Everything required is in place. Our team reviews new businesses within a few working
          days, and your listing goes live once approved.
        </p>
      )}

      <SubmitButton pendingLabel="Submitting…">Submit for review</SubmitButton>
    </form>
  )
}
