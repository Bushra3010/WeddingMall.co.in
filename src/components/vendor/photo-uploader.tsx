'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { uploadPhotoAction } from '@/features/listings/actions'
import { MAX_IMAGE_BYTES } from '@/features/listings/schema'
import { compressImage, formatBytes, ImagePrepareError, MAX_EDGE_PX } from '@/lib/images/compress'
import { cn } from '@/lib/utils'

/**
 * The portfolio upload control, shared by the listing wizard's Media step and
 * the Portfolio screen.
 *
 * Both used to render their own `<form action={uploadMediaAction}>`, which sent
 * every selected photo in one Server Action body — and that body is capped at
 * 12 MB, so picking two ordinary phone photos was refused before the upload
 * began. This replaces both.
 *
 * Three things changed, and each one is load-bearing:
 *
 * 1. **Each photo is downscaled in the browser first** (`lib/images/compress`),
 *    which is where the 13 MB goes to about 1 MB.
 * 2. **One request per photo.** The batch total stops mattering, so "a few at a
 *    time for large photos" is no longer a rule the vendor has to follow.
 * 3. **Failures are per photo.** Eight uploaded and one rejected now reads as
 *    eight uploaded and one rejected, rather than as one failed request.
 *
 * The compression is a convenience, not a check. `uploadMedia()` re-validates
 * MIME and size server-side and the bucket enforces its own limit behind that.
 */

type Phase = 'queued' | 'preparing' | 'uploading' | 'done' | 'failed'

interface Item {
  file: File
  phase: Phase
  /** Size after preparation, once known — shown so the saving is visible. */
  finalBytes?: number
  error?: string
}

export function PhotoUploader({
  vendorId,
  className,
  onUploaded,
}: {
  vendorId: string
  className?: string
  /** Called after a run that uploaded at least one photo. */
  onUploaded?: (count: number) => void
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [altText, setAltText] = useState('')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  function patch(index: number, changes: Partial<Item>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...changes } : item)))
  }

  function choose(files: FileList | null) {
    setSummary(null)
    setItems(Array.from(files ?? []).map((file) => ({ file, phase: 'queued' as const })))
  }

  async function upload() {
    if (items.length === 0 || busy) return

    setBusy(true)
    setSummary(null)

    let uploaded = 0
    let failed = 0

    // Sequential, not `Promise.all`. `uploadMedia` reads the current photo count
    // to decide which image becomes the cover and what sort order to write, so
    // concurrent uploads would race on both — several photos claiming position
    // zero, and the partial unique index on `is_cover` refusing all but one.
    for (const [index, item] of items.entries()) {
      let prepared = item.file

      patch(index, { phase: 'preparing' })
      try {
        prepared = await compressImage(item.file)
      } catch (error) {
        if (error instanceof ImagePrepareError) {
          patch(index, { phase: 'failed', error: error.message })
          failed += 1
          continue
        }
        // Anything else: send the original and let the server decide. A
        // browser that cannot run a canvas is not a reason to refuse an upload
        // that would otherwise have been fine.
        prepared = item.file
      }

      if (prepared.size > MAX_IMAGE_BYTES) {
        patch(index, {
          phase: 'failed',
          error: `Still ${formatBytes(prepared.size)} after resizing — this one is too large to upload.`,
        })
        failed += 1
        continue
      }

      patch(index, { phase: 'uploading', finalBytes: prepared.size })

      const form = new FormData()
      form.set('vendorId', vendorId)
      form.set('file', prepared)
      if (altText.trim()) form.set('altText', altText.trim())

      const result = await uploadPhotoAction(form)

      if (result.ok) {
        patch(index, { phase: 'done' })
        uploaded += 1
      } else {
        patch(index, { phase: 'failed', error: result.message })
        failed += 1
      }
    }

    setBusy(false)
    setSummary(
      failed === 0
        ? `${uploaded} photo${uploaded === 1 ? '' : 's'} uploaded.`
        : `${uploaded} uploaded, ${failed} could not be. See the list below.`,
    )

    if (uploaded > 0) {
      // Clear only what succeeded — a failed photo stays on screen with its
      // reason, so the vendor can see which one to replace.
      setItems((current) => current.filter((item) => item.phase !== 'done'))
      if (inputRef.current) inputRef.current.value = ''
      setAltText('')
      onUploaded?.(uploaded)
      router.refresh()
    }
  }

  const done = items.filter((item) => item.phase === 'done').length
  const anyFailed = items.some((item) => item.phase === 'failed')

  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <label htmlFor={`photos-${vendorId}`} className="text-sand-800 block text-sm font-medium">
          Photos
        </label>
        <p className="text-sand-500 mt-0.5 text-xs">
          JPG, PNG, WebP or AVIF. Pick as many as you like — large photos are resized to{' '}
          {MAX_EDGE_PX}px in your browser before they are sent, so they upload quickly.
        </p>
        <input
          ref={inputRef}
          id={`photos-${vendorId}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          disabled={busy}
          onChange={(event) => choose(event.target.files)}
          className="border-sand-300 mt-1.5 block w-full rounded-lg border bg-white p-2 text-sm disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor={`alt-${vendorId}`} className="text-sand-800 block text-sm font-medium">
          Description
        </label>
        <p className="text-sand-500 mt-0.5 text-xs">
          Optional, and applied to every photo in this batch. You can write a specific one for each
          photo afterwards.
        </p>
        <Input
          id={`alt-${vendorId}`}
          value={altText}
          disabled={busy}
          onChange={(event) => setAltText(event.target.value)}
          placeholder="e.g. Wedding ceremony setup with floral arch"
          className="mt-1.5"
        />
      </div>

      {items.length > 0 ? (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-lg border bg-white text-sm">
          {items.map((item, index) => (
            <li key={`${item.file.name}-${index}`} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate">
                <span className="text-sand-900">{item.file.name}</span>
                <span className="text-sand-500 ml-2 text-xs">
                  {formatBytes(item.file.size)}
                  {item.finalBytes && item.finalBytes < item.file.size
                    ? ` → ${formatBytes(item.finalBytes)}`
                    : ''}
                </span>
                {item.error ? (
                  <span className="mt-0.5 block text-xs text-[var(--color-danger)]">
                    {item.error}
                  </span>
                ) : null}
              </span>
              <span className="text-sand-600 shrink-0 text-xs">{phaseLabel(item.phase)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {summary ? (
        <p
          role="status"
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            anyFailed
              ? 'bg-[color-mix(in_oklch,var(--color-danger)_10%,white)] text-[var(--color-danger)]'
              : 'bg-[color-mix(in_oklch,var(--color-success)_12%,white)] text-[var(--color-success)]',
          )}
        >
          {summary}
        </p>
      ) : null}

      <Button type="button" onClick={upload} disabled={busy || items.length === 0} aria-busy={busy}>
        {busy ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" />
            Uploading {Math.min(done + 1, items.length)} of {items.length}…
          </>
        ) : (
          <>
            <ImagePlus aria-hidden="true" />
            Upload{' '}
            {items.length > 0 ? `${items.length} photo${items.length === 1 ? '' : 's'}` : 'photos'}
          </>
        )}
      </Button>

      <p className="text-sand-500 text-xs">
        New photos are reviewed before they appear on your public profile.
      </p>
    </div>
  )
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case 'preparing':
      return 'Resizing…'
    case 'uploading':
      return 'Uploading…'
    case 'done':
      return 'Uploaded'
    case 'failed':
      return 'Failed'
    default:
      return 'Waiting'
  }
}
