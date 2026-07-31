'use client'

import Image from 'next/image'
import { ImagePlus, Star, Trash2 } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import {
  deleteMediaAction,
  setCoverAction,
  updateMediaAltAction,
  uploadMediaAction,
} from '@/features/listings/actions'
import { storagePublicUrl } from '@/lib/supabase/storage'
import { cn } from '@/lib/utils'
import type { VendorMediaRow } from '@/server/dal/listings'

/**
 * Portfolio (PRD 6.9). Alt text is collected per image rather than left
 * optional-forever: it is required for the accessibility target in PRD 7.3 and
 * the descriptive-alt requirement in PRD 11.2.
 */
export function PortfolioManager({
  vendorId,
  media,
  readOnly,
}: {
  vendorId: string
  media: VendorMediaRow[]
  readOnly: boolean
}) {
  const [uploadState, upload] = useAction(uploadMediaAction)
  const [altState, saveAlt] = useAction(updateMediaAltAction)
  const [coverState, setCover] = useAction(setCoverAction)
  const [deleteState, remove] = useAction(deleteMediaAction)

  const missingAlt = media.filter((item) => !item.altText?.trim()).length

  return (
    <div className="space-y-6">
      <FormMessage state={uploadState} successMessage="Images uploaded." />
      <FormMessage state={altState} successMessage="Description saved." />
      <FormMessage state={coverState} successMessage="Cover image updated." />
      <FormMessage state={deleteState} successMessage="Image removed." />

      {missingAlt > 0 ? (
        <p className="border-accent-300 bg-accent-100 text-sand-900 rounded-lg border px-3 py-2 text-sm">
          {missingAlt} {missingAlt === 1 ? 'image needs' : 'images need'} a short description. These
          are read aloud by screen readers and help your listing rank.
        </p>
      ) : null}

      {media.length === 0 ? (
        <p className="border-sand-300 text-sand-600 rounded-[var(--radius-card)] border border-dashed bg-white p-6 text-center text-sm">
          No photos yet. Your portfolio is the first thing couples look at.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => {
            const url = storagePublicUrl('vendor-media', item.storagePath)
            return (
              <li
                key={item.id}
                className="border-sand-200 overflow-hidden rounded-[var(--radius-card)] border bg-white"
              >
                <div className="bg-sand-100 relative aspect-4/3">
                  {url ? (
                    <Image
                      src={url}
                      alt={item.altText ?? ''}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : null}
                  {item.isCover ? (
                    <span className="bg-brand-700 absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-medium text-white">
                      Cover
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'absolute top-2 right-2 rounded-full px-2 py-0.5 text-[11px] font-medium',
                      item.moderationStatus === 'approved'
                        ? 'bg-[var(--color-success)] text-white'
                        : item.moderationStatus === 'rejected'
                          ? 'bg-[var(--color-danger)] text-white'
                          : 'bg-sand-200 text-sand-800',
                    )}
                  >
                    {item.moderationStatus === 'approved'
                      ? 'Live'
                      : item.moderationStatus === 'rejected'
                        ? 'Rejected'
                        : 'In review'}
                  </span>
                </div>

                {!readOnly ? (
                  <div className="space-y-3 p-3">
                    <form action={saveAlt} className="space-y-2">
                      <input type="hidden" name="vendorId" value={vendorId} />
                      <input type="hidden" name="mediaId" value={item.id} />
                      <Field label="Describe this image" error={fieldError(altState, 'altText')}>
                        {({ id, describedBy, invalid }) => (
                          <Input
                            id={id}
                            name="altText"
                            defaultValue={item.altText ?? ''}
                            placeholder="e.g. Bride and groom under a floral mandap"
                            aria-describedby={describedBy}
                            invalid={invalid}
                          />
                        )}
                      </Field>
                      <Button type="submit" variant="ghost" size="sm">
                        Save description
                      </Button>
                    </form>

                    <div className="border-sand-200 flex gap-2 border-t pt-3">
                      {!item.isCover ? (
                        <form action={setCover}>
                          <input type="hidden" name="vendorId" value={vendorId} />
                          <input type="hidden" name="mediaId" value={item.id} />
                          <Button type="submit" variant="outline" size="sm">
                            <Star aria-hidden="true" />
                            Make cover
                          </Button>
                        </form>
                      ) : null}
                      <form action={remove}>
                        <input type="hidden" name="vendorId" value={vendorId} />
                        <input type="hidden" name="mediaId" value={item.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          aria-label="Remove this image"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <p className="text-sand-600 p-3 text-sm">{item.altText ?? 'No description'}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!readOnly ? (
        <form
          action={upload}
          className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
        >
          <h2 className="font-display text-sand-900 text-lg">Add photos</h2>
          <input type="hidden" name="vendorId" value={vendorId} />

          <Field label="Images" hint="JPEG, PNG, WebP, or AVIF. Up to 10 MB each." required>
            {({ id }) => (
              <input
                id={id}
                name="files"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                required
                className="text-sand-700 file:bg-sand-100 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
              />
            )}
          </Field>

          <Field
            label="Description for these images"
            hint="Optional now — you can write a specific one for each image after uploading."
          >
            {({ id }) => <Input id={id} name="altText" />}
          </Field>

          <SubmitButton pendingLabel="Uploading…">
            <ImagePlus aria-hidden="true" />
            Upload
          </SubmitButton>

          <p className="text-sand-500 text-xs">
            New images are reviewed before they appear on your public profile.
          </p>
        </form>
      ) : null}
    </div>
  )
}
