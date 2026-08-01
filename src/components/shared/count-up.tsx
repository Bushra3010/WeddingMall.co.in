'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Counts up to a value when it scrolls into view.
 *
 * Renders the final value immediately for reduced-motion users and before
 * hydration, so the number is never wrong or missing — the animation is an
 * embellishment on top of correct output.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 1400,
}: {
  value: number
  decimals?: number
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    let start: number | null = null

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        // Reset here rather than in the effect body: this is an event
        // callback, so it does not cascade a render on mount.
        setDisplay(0)

        const step = (now: number) => {
          start ??= now
          const elapsed = now - start
          const progress = Math.min(elapsed / duration, 1)
          // Ease-out cubic: fast start, gentle settle.
          const eased = 1 - Math.pow(1 - progress, 3)
          setDisplay(value * eased)
          if (progress < 1) frame = requestAnimationFrame(step)
        }
        frame = requestAnimationFrame(step)
      },
      { threshold: 0.4 },
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, duration])

  return (
    <span ref={ref}>
      {display.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  )
}
