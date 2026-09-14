'use client'

import Image from 'next/image'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface GalleryImage {
  id: string
  src: string
  /** Always non-empty — the page synthesises one when the row has no alt text. */
  alt: string
  /** The vendor's own description, shown as a caption. Null when unset. */
  caption: string | null
}

/**
 * Vendor photos (PRD 6.3) — one large frame with a thumbnail strip, replacing
 * the separate cover image and four-across portfolio grid.
 *
 * Three things are deliberate:
 *
 * 1. **Only the current slide and its two neighbours are mounted.** A venue can
 *    carry thirty photographs; stacking them all absolutely at full size and
 *    hiding them with opacity keeps every one of them inside the viewport as
 *    far as the lazy-loading observer is concerned, so the browser fetches the
 *    lot on first paint. The thumbnails still put every image in the markup for
 *    crawlers, at thumbnail cost.
 * 2. **The first slide renders on the server with `priority`.** This is the
 *    page's LCP element; it must not wait for hydration.
 * 3. **The strip is scrolled by setting `scrollLeft`, not `scrollIntoView()`.**
 *    The latter walks every scrollable ancestor, so centring a thumbnail also
 *    scrolls the page — the gallery jumps under the header on each arrow press.
 */
export function VendorGallery({ images, className }: { images: GalleryImage[]; className?: string }) {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)

  const stripRef = useRef<HTMLUListElement>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const viewAllRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const headingId = useId()
  const dialogId = useId()

  const count = images.length
  /*
   * A delta applied to the *previous* state, not to `index` from this render.
   * React batches clicks that land in one tick, so an absolute `index + 1`
   * collapses a quick double-press on the arrow into a single advance.
   */
  const step = useCallback(
    (delta: number) => setIndex((i) => (((i + delta) % count) + count) % count),
    [count],
  )

  // Keep the active thumbnail centred in its own scroller, page untouched.
  useEffect(() => {
    const strip = stripRef.current
    const thumb = thumbRefs.current[index]
    if (!strip || !thumb) return

    // Smoothness comes from `scroll-smooth` on the strip, which
    // `motion-reduce:scroll-auto` turns off — one CSS rule instead of reading
    // the media query here, so the preference is honoured without JavaScript.
    strip.scrollLeft = Math.max(0, thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2)
  }, [index])

  // The lightbox: Escape closes, the page behind it does not scroll, and focus
  // returns to the control that opened it.
  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    // Captured now: by cleanup time the ref may already point elsewhere.
    const opener = viewAllRef.current

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [open])

  if (count === 0) return null

  const current = images[index]
  const many = count > 1

  return (
    <section
      aria-roledescription="carousel"
      aria-labelledby={headingId}
      className={cn('space-y-3', className)}
      onKeyDown={(event) => {
        if (!many) return
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          step(-1)
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          step(1)
        }
      }}
    >
      <h2 id={headingId} className="sr-only">
        Photos
      </h2>

      <div className="bg-sand-100 relative aspect-4/3 overflow-hidden rounded-[var(--radius-card)] sm:aspect-16/9">
        {images.map((image, position) => {
          // Current plus one either side; see the note above the component.
          const distance = Math.min(
            Math.abs(position - index),
            count - Math.abs(position - index),
          )
          if (distance > 1) return null

          return (
            <Image
              key={image.id}
              src={image.src}
              alt={image.alt}
              fill
              priority={position === 0}
              sizes="(max-width: 1024px) 100vw, 1024px"
              className={cn(
                'object-cover motion-safe:transition-opacity motion-safe:duration-300',
                position === index ? 'opacity-100' : 'opacity-0',
              )}
            />
          )
        })}

        {/* Scrim. Without it the caption and counter sit on whatever the
            photograph happens to be, which is often a white marquee. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent"
        />

        {many ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => step(-1)}
              className="text-sand-800 absolute top-1/2 left-3 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-[var(--shadow-soft)] transition-colors hover:bg-white sm:left-4"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => step(1)}
              className="text-sand-800 absolute top-1/2 right-3 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-[var(--shadow-soft)] transition-colors hover:bg-white sm:right-4"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </>
        ) : null}

        {current.caption ? (
          <p className="absolute bottom-4 left-4 max-w-[55%] text-sm font-medium text-white drop-shadow-sm sm:bottom-5 sm:left-5">
            {current.caption}
          </p>
        ) : null}

        <div className="absolute right-3 bottom-4 flex flex-col items-end gap-2 sm:right-5 sm:bottom-5">
          {many ? (
            <p
              aria-live="polite"
              aria-atomic="true"
              className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white tabular-nums"
            >
              {index + 1} / {count}
            </p>
          ) : null}

          {many ? (
            <button
              ref={viewAllRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className="text-sand-900 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold shadow-[var(--shadow-soft)] transition-colors hover:bg-white sm:text-sm"
            >
              <Images aria-hidden="true" className="size-4" />
              View all images
            </button>
          ) : null}
        </div>
      </div>

      {many ? (
        <ul
          ref={stripRef}
          className="no-scrollbar -mx-4 flex gap-2 scroll-smooth overflow-x-auto px-4 motion-reduce:scroll-auto sm:mx-0 sm:px-0"
        >
          {images.map((image, position) => (
            <li key={image.id} className="shrink-0">
              <button
                ref={(node) => {
                  thumbRefs.current[position] = node
                }}
                type="button"
                aria-label={`Show photo ${position + 1} of ${count}`}
                aria-current={position === index}
                onClick={() => setIndex(position)}
                className={cn(
                  'bg-sand-100 relative block h-14 w-20 overflow-hidden rounded-lg transition-all sm:h-16 sm:w-24',
                  position === index
                    ? 'ring-brand-600 ring-offset-sand-50 opacity-100 ring-2 ring-offset-2'
                    : 'opacity-70 hover:opacity-100',
                )}
              >
                <Image src={image.src} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="true"
          aria-label={`All ${count} photos`}
          className="bg-sand-950/90 fixed inset-0 z-50 overflow-y-auto p-4 backdrop-blur-sm sm:p-8"
        >
          <div className="mx-auto max-w-5xl">
            <div className="sticky top-0 z-10 flex items-center justify-between py-2">
              <p className="text-sm font-medium text-white">All {count} photos</p>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="text-sand-900 inline-flex size-10 items-center justify-center rounded-full bg-white/95 transition-colors hover:bg-white"
              >
                <X aria-hidden="true" className="size-5" />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((image, position) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIndex(position)
                      setOpen(false)
                    }}
                    className="bg-sand-800 relative block aspect-square w-full overflow-hidden rounded-lg"
                  >
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  )
}
