'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Testimonial } from '@/server/dal/homepage'

/**
 * Testimonials (PRD 6.1.8) — admin-managed rows, not hard-coded copy.
 *
 * Auto-advances, but pauses on hover or keyboard focus and does not advance at
 * all under prefers-reduced-motion. A carousel that moves while someone is
 * reading is an accessibility problem, not a flourish (PRD 7.3).
 */
export function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || testimonials.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timer = setInterval(() => setIndex((i) => (i + 1) % testimonials.length), 6000)
    return () => clearInterval(timer)
  }, [paused, testimonials.length])

  if (testimonials.length === 0) return null

  const current = testimonials[index]

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        aria-live="polite"
        aria-atomic="true"
        className="border-sand-200 relative overflow-hidden rounded-[var(--radius-panel)] border bg-white p-8 shadow-[var(--shadow-soft)] sm:p-12"
      >
        <Quote
          aria-hidden="true"
          className="text-brand-100 absolute -top-2 right-6 size-24 motion-safe:animate-[drift_12s_ease-in-out_infinite_alternate]"
        />

        <div className="relative">
          <div className="text-gold-500 flex gap-0.5" aria-label="Rated 5 out of 5">
            {Array.from({ length: 5 }).map((_, star) => (
              <Star key={star} aria-hidden="true" className="size-4 fill-current" />
            ))}
          </div>

          <blockquote className="font-display text-sand-900 mt-5 text-xl leading-relaxed sm:text-2xl">
            “{current.body}”
          </blockquote>

          <figcaption className="text-sand-600 mt-6 text-sm">
            <span className="text-sand-900 font-medium">{current.authorName}</span>
            {current.authorCity ? <span> · {current.authorCity}</span> : null}
          </figcaption>
        </div>
      </div>

      {testimonials.length > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Previous testimonial"
            onClick={() => setIndex((i) => (i - 1 + testimonials.length) % testimonials.length)}
            className="border-sand-200 text-sand-700 hover:border-brand-300 hover:text-brand-700 inline-flex size-10 items-center justify-center rounded-full border bg-white transition-colors"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>

          <div className="flex gap-1.5">
            {testimonials.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show testimonial ${i + 1} of ${testimonials.length}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === index ? 'bg-brand-600 w-6' : 'bg-sand-300 hover:bg-sand-400 w-2',
                )}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Next testimonial"
            onClick={() => setIndex((i) => (i + 1) % testimonials.length)}
            className="border-sand-200 text-sand-700 hover:border-brand-300 hover:text-brand-700 inline-flex size-10 items-center justify-center rounded-full border bg-white transition-colors"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
