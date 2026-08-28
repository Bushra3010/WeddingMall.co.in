'use client'

import { useEffect, useRef } from 'react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import {
  saveProfileAction,
  saveListingAction,
  saveCategoriesAction,
  saveServiceAreasAction,
  uploadDocumentAction,
  deleteDocumentAction,
  submitForReviewAction,
} from '@/features/vendors/actions'
import { uploadMediaAction } from '@/features/listings/actions'
import type { VendorWorkspace, VerificationDocument } from '@/server/dal/vendor-workspace'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

const STEP_SECTION = 'space-y-4'

/**
 * Calls `onSuccess` once, when an action's state flips to ok.
 *
 * Adjusted during render rather than in an effect — React's documented way to
 * react to a changed value, and the pattern already used elsewhere in this
 * codebase. It is what lets the wizard shell advance a step only after the
 * server has actually accepted the data, rather than optimistically on click.
 */
/**
 * Run `onSuccess` once, the first time an action result comes back ok.
 *
 * The advance has to happen in an effect, not during render. Adjusting state
 * while rendering is only legal for a component's own state; `onSuccess` here
 * moves the *parent* wizard to the next step, and React warned about exactly
 * that ("Cannot update a component while rendering a different component").
 * It happened to work, which is the dangerous kind of wrong.
 *
 * The ref holds the last result object seen rather than a boolean, so two
 * consecutive successful saves of the same step each advance — comparing on
 * `ok` alone would swallow the second.
 */
function useOnSaved(state: { ok: boolean } | null, onSuccess?: () => void) {
  const seen = useRef(state)

  useEffect(() => {
    if (seen.current === state) return
    seen.current = state
    if (state?.ok) onSuccess?.()
  }, [state, onSuccess])
}

export function WizardBusinessStep({
  vendor,
  cities,
  readOnly,
  vendorId,
  onSaved,
}: {
  vendor: VendorWorkspace
  cities: CityRow[]
  readOnly: boolean
  vendorId: string
  onSaved?: () => void
}) {
  const [state, action] = useAction(saveProfileAction)
  useOnSaved(state, onSaved)

  return (
    <div className={STEP_SECTION}>
      <p className="text-sand-600 text-sm">
        The basics couples see first. All fields are editable later.
      </p>

      <form action={action} id="wizard-form-business">
        <input type="hidden" name="vendorId" value={vendorId} />
        <FormMessage state={state} successMessage="Saved." />

        <div className="mt-4 space-y-4">
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

          {/*
            Both optional, and both stored on `vendor_addresses` rather than on
            the vendor row — that table has existed since 0004 for exactly this
            and was never wired up.
          */}
          <Field
            label="Address"
            hint="Street address, if couples can visit you. Optional."
            error={fieldError(state, 'addressLine')}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="addressLine"
                defaultValue={vendor.addressLine ?? ''}
                disabled={readOnly}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field
            label="Location link"
            hint="A Google Maps, Apple Maps, or OpenStreetMap link. Optional."
            error={fieldError(state, 'mapsUrl')}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="mapsUrl"
                type="url"
                placeholder="https://"
                defaultValue={vendor.mapsUrl ?? ''}
                disabled={readOnly}
                aria-describedby={describedBy}
                invalid={invalid}
              />
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

          {!readOnly ? (
            <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…">
              Save details
            </SubmitButton>
          ) : null}
        </div>
      </form>
    </div>
  )
}

export function WizardAboutStep({
  vendor,
  readOnly,
  vendorId,
  onSaved,
}: {
  vendor: VendorWorkspace
  readOnly: boolean
  vendorId: string
  onSaved?: () => void
}) {
  const [state, action] = useAction(saveListingAction)
  useOnSaved(state, onSaved)

  return (
    <div className={STEP_SECTION}>
      <p className="text-sand-600 text-sm">
        Write 50+ characters about your business. This is the first thing couples read.
      </p>

      <form action={action} id="wizard-form-about">
        <input type="hidden" name="vendorId" value={vendorId} />
        <FormMessage state={state} successMessage="Saved." />

        <div className="mt-4 space-y-4">
          <Field
            label="Description"
            hint="At least 50 characters. Tell couples what makes you different."
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
                rows={6}
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

          {!readOnly ? (
            <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…">
              Save description
            </SubmitButton>
          ) : null}
        </div>
      </form>
    </div>
  )
}

export function WizardCategoriesStep({
  vendor,
  categories,
  readOnly,
  vendorId,
  onSaved,
}: {
  vendor: VendorWorkspace
  categories: CategoryRow[]
  readOnly: boolean
  vendorId: string
  onSaved?: () => void
}) {
  const [state, action] = useAction(saveCategoriesAction)
  useOnSaved(state, onSaved)

  return (
    <div className={STEP_SECTION}>
      <p className="text-sand-600 text-sm">
        Pick your main category. You can add up to 5 more later.
      </p>

      <form action={action} id="wizard-form-categories">
        <input type="hidden" name="vendorId" value={vendorId} />
        <FormMessage state={state} successMessage="Saved." />

        <div className="mt-4 space-y-4">
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
            <p className="text-sand-600 mt-1 mb-2 text-xs">Optional. Up to 5 more categories.</p>
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

          {!readOnly ? (
            <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…">
              Save categories
            </SubmitButton>
          ) : null}
        </div>
      </form>
    </div>
  )
}

export function WizardAreasStep({
  vendor,
  cities,
  readOnly,
  vendorId,
  onSaved,
}: {
  vendor: VendorWorkspace
  cities: CityRow[]
  readOnly: boolean
  vendorId: string
  onSaved?: () => void
}) {
  const [state, action] = useAction(saveServiceAreasAction)
  useOnSaved(state, onSaved)

  return (
    <div className={STEP_SECTION}>
      <p className="text-sand-600 text-sm">
        Choose the cities you serve. Check &ldquo;travel available&rdquo; if you go on location.
      </p>

      <form action={action} id="wizard-form-areas">
        <input type="hidden" name="vendorId" value={vendorId} />
        <FormMessage state={state} successMessage="Saved." />

        <div className="mt-4 space-y-4">
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

          {!readOnly ? (
            <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…">
              Save areas
            </SubmitButton>
          ) : null}
        </div>
      </form>
    </div>
  )
}

export function WizardMediaStep({
  vendor,
  readOnly,
  vendorId,
}: {
  vendor: VendorWorkspace
  readOnly: boolean
  vendorId: string
}) {
  const [, upload] = useAction(uploadMediaAction)

  return (
    <div className={STEP_SECTION}>
      <p className="text-sand-600 text-sm">
        Your portfolio is the first thing couples look at. Add at least 3 high-quality photos.
      </p>

      {vendor.mediaCount > 0 ? (
        <p className="text-sand-600 text-sm">
          You have <strong>{vendor.mediaCount}</strong> photo{vendor.mediaCount !== 1 ? 's' : ''}{' '}
          uploaded. You can add more in the Portfolio section.
        </p>
      ) : (
        <p className="text-sand-500 text-sm">
          No photos yet. Upload your best work to attract more enquiries.
        </p>
      )}

      {!readOnly ? (
        <form action={upload} className="border-sand-200 mt-4 space-y-3 border-t pt-4">
          <input type="hidden" name="vendorId" value={vendorId} />

          <div>
            <label className="text-sand-800 block text-sm font-medium">
              Photos <span className="text-[var(--color-danger)]">*</span>
            </label>
            <p className="text-sand-500 mt-0.5 text-xs">
              Upload up to 20 images at a time. JPG, PNG. Up to 5 MB each.
            </p>
            <input
              type="file"
              name="files"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="border-sand-300 mt-1.5 block w-full rounded-lg border bg-white p-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sand-800 block text-sm font-medium">Alt text</label>
            <p className="text-sand-500 mt-0.5 text-xs">
              Describe the image for accessibility (optional).
            </p>
            <input
              type="text"
              name="altText"
              className="border-sand-300 mt-1.5 h-11 w-full rounded-lg border bg-white px-3 text-sm"
              placeholder="e.g. Wedding ceremony setup with floral arch"
            />
          </div>

          <SubmitButton pendingLabel="Uploading…">Upload photos</SubmitButton>
        </form>
      ) : null}

      <div className="mt-4 text-right">
        <a
          href="/vendor-dashboard/portfolio"
          className="text-brand-700 text-sm font-medium hover:underline"
        >
          Manage all media in portfolio &rarr;
        </a>
      </div>
    </div>
  )
}

export function WizardDocumentsStep({
  vendor: _vendor,
  documents,
  readOnly,
  vendorId,
}: {
  vendor: VendorWorkspace
  documents: VerificationDocument[]
  readOnly: boolean
  vendorId: string
}) {
  const [uploadState, upload] = useAction(uploadDocumentAction)
  const [deleteState, remove] = useAction(deleteDocumentAction)

  return (
    <div className={STEP_SECTION}>
      <p className="text-sand-600 text-sm">
        Upload a business registration or GST certificate for the verified badge. Documents are
        private — only the verification team can see them.
      </p>

      <FormMessage state={uploadState} successMessage="Document uploaded." />
      <FormMessage state={deleteState} successMessage="Document removed." />

      {documents.length > 0 ? (
        <ul className="divide-sand-200 border-sand-200 mt-4 divide-y rounded-lg border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="text-sand-900 font-medium">{doc.documentType}</p>
              </div>
              {!readOnly ? (
                <form action={remove}>
                  <input type="hidden" name="documentId" value={doc.id} />
                  <button
                    type="submit"
                    className="text-xs text-[var(--color-danger)] hover:underline"
                  >
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-sand-300 text-sand-600 mt-4 rounded-lg border border-dashed p-4 text-sm">
          No documents uploaded yet. Add at least one to earn the verified badge.
        </p>
      )}

      {!readOnly ? (
        <form action={upload} className="border-sand-200 mt-4 space-y-3 border-t pt-4">
          <input type="hidden" name="vendorId" value={vendorId} />

          <div>
            <label className="text-sand-800 block text-sm font-medium">
              Document type <span className="text-[var(--color-danger)]">*</span>
            </label>
            <select
              name="documentType"
              required
              className="border-sand-300 mt-1.5 h-11 w-full rounded-lg border bg-white px-3 text-sm"
            >
              <option value="">Choose type</option>
              <option value="business_registration">Business registration</option>
              <option value="gst">GST certificate</option>
              <option value="pan">PAN card</option>
              <option value="identity">Owner identity document</option>
              <option value="address_proof">Address proof</option>
              <option value="other">Other supporting document</option>
            </select>
          </div>

          <div>
            <label className="text-sand-800 block text-sm font-medium">
              File <span className="text-[var(--color-danger)]">*</span>
            </label>
            <p className="text-sand-500 mt-0.5 text-xs">PDF, JPEG, or PNG. Up to 10 MB.</p>
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,application/pdf"
              required
              className="border-sand-300 mt-1.5 block w-full rounded-lg border bg-white p-2 text-sm"
            />
          </div>

          <SubmitButton pendingLabel="Uploading…">Upload document</SubmitButton>
        </form>
      ) : null}
    </div>
  )
}

export function WizardSubmitStep({
  vendor,
  vendorId,
  canSubmit,
}: {
  vendor: VendorWorkspace
  vendorId: string
  canSubmit: boolean
}) {
  const [state, action] = useAction(submitForReviewAction)
  const blocked = vendor.completion.missingRequired

  return (
    <div className={STEP_SECTION}>
      <p className="text-sand-600 text-sm">
        Your listing is ready to go live once our team reviews it. Nothing is public until approved.
      </p>

      <form
        action={action}
        className="border-sand-200 bg-sand-50 mt-4 rounded-[var(--radius-card)] border p-5"
      >
        <input type="hidden" name="vendorId" value={vendorId} />
        <FormMessage state={state} successMessage="Submitted! We will be in touch shortly." />

        {blocked.length > 0 ? (
          <div className="rounded-lg bg-white p-3 text-sm">
            <p className="text-sand-900 font-medium">Before you can submit, add:</p>
            <ul className="text-sand-700 mt-1 list-inside list-disc">
              {blocked.map((field) => {
                const scrollTarget =
                  field.key === 'displayName' || field.key === 'city'
                    ? 'business'
                    : field.key === 'about'
                      ? 'about'
                      : field.key === 'categories'
                        ? 'categories'
                        : field.key === 'serviceAreas'
                          ? 'areas'
                          : field.key === 'media'
                            ? 'media'
                            : field.key === 'documents'
                              ? 'documents'
                              : field.key
                return (
                  <li key={field.key}>
                    {field.label} —{' '}
                    <a
                      href={`#step-${scrollTarget}`}
                      onClick={(e) => {
                        e.preventDefault()
                        const el = document.getElementById(`step-${scrollTarget}`)
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className="text-brand-700 hover:underline"
                    >
                      add now
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg bg-white p-3 text-sm">
            <p className="text-sand-900 font-medium">Everything looks good!</p>
            <p className="text-sand-700 mt-1">
              Our team reviews new businesses within a few working days. Your listing goes live once
              approved.
            </p>
          </div>
        )}

        <div className="mt-4">
          <SubmitButton
            className="w-full sm:w-auto"
            pendingLabel="Submitting…"
            disabled={!canSubmit || blocked.length > 0}
          >
            Submit for review
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}
