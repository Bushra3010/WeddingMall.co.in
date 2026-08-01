'use client'

import { useRef, useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { CityRow } from '@/server/dal/taxonomy'

/**
 * City scope control (PRD 6.1.1).
 *
 * A real `<form method="get" action="/vendors">` wrapping a real `<select>`,
 * so it navigates correctly before hydration and for anyone without client
 * JavaScript; the script only saves a tap by submitting on change.
 *
 * The choice is deliberately *not* persisted in a cookie. Reading cookies in a
 * public route opts it out of static rendering for every visitor (ADR-003),
 * which is a steep price for remembering a dropdown. The selection lives in
 * the URL instead, where it is shareable and back-navigable.
 */
export function CitySelector({
  cities,
  variant = 'light',
  className,
}: {
  cities: CityRow[]
  /** `light` sits on a dark hero, `dark` on the solid white header. */
  variant?: 'light' | 'dark'
  className?: string
}) {
  const form = useRef<HTMLFormElement>(null)
  const [city, setCity] = useState('')

  if (cities.length === 0) return null

  const label = cities.find((item) => item.slug === city)?.name ?? 'All India'

  return (
    <form
      ref={form}
      action="/vendors"
      method="get"
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        variant === 'light'
          ? 'border border-white/25 bg-white/15 text-white backdrop-blur hover:bg-white/25'
          : 'border-sand-200 text-sand-700 hover:border-brand-300 hover:text-brand-700 border bg-white',
        className,
      )}
    >
      <MapPin aria-hidden="true" className="size-4 shrink-0" />
      <span className="max-w-28 truncate">{label}</span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-70" />

      {/*
        The native select is stretched invisibly over the pill so the control
        opens the platform picker — far better on a phone than a custom menu —
        while the visible text stays styled to the header.
      */}
      <select
        name="city"
        value={city}
        aria-label="Choose a city"
        onChange={(event) => {
          setCity(event.target.value)
          form.current?.requestSubmit()
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">All India</option>
        {cities.map((item) => (
          <option key={item.id} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>

      {/* Keyboard/no-JS path: the form still has a way to submit. */}
      <button type="submit" className="sr-only">
        Browse vendors in this city
      </button>
    </form>
  )
}
