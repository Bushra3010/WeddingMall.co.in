'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { buildSearchUrl } from '@/features/search/filters'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

/**
 * Hero search (PRD 6.1.2). Submitting builds the canonical search URL rather
 * than posting, so the result is shareable and back-navigable (PRD 6.1
 * acceptance). It is a real `<form>`, so it works before hydration.
 */
export function HeroSearch({
  categories,
  cities,
}: {
  categories: CategoryRow[]
  cities: CityRow[]
}) {
  const router = useRouter()
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [q, setQ] = useState('')

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.push(
      buildSearchUrl({
        category: category || undefined,
        city: city || undefined,
        q: q || undefined,
      }),
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      action="/vendors"
      method="get"
      className="grid gap-3 rounded-[var(--radius-card)] bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end"
    >
      <div>
        <label htmlFor="hero-q" className="text-sand-700 mb-1 block text-xs font-medium">
          Search by name or keyword
        </label>
        <input
          id="hero-q"
          name="q"
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="e.g. banquet hall, candid photography"
          className="border-sand-300 placeholder:text-sand-400 h-11 w-full rounded-lg border bg-white px-3 text-sm"
        />
      </div>

      <div>
        <label htmlFor="hero-category" className="text-sand-700 mb-1 block text-xs font-medium">
          What are you looking for?
        </label>
        <select
          id="hero-category"
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="hero-city" className="text-sand-700 mb-1 block text-xs font-medium">
          Where?
        </label>
        <select
          id="hero-city"
          name="city"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
        >
          <option value="">All cities</option>
          {cities.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" size="lg" className="sm:col-span-2 lg:col-span-1 lg:w-auto">
        <Search aria-hidden="true" />
        Search
      </Button>
    </form>
  )
}
