'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Building2, CalendarDays, IndianRupee, MapPin, Search, Tag, Users } from 'lucide-react'

import { buildSearchUrl } from '@/features/search/filters'
import { cn } from '@/lib/utils'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

/**
 * Hero search card (PRD 6.1.2).
 *
 * Submitting builds the canonical search URL rather than posting, so the
 * result is shareable, indexable where appropriate, and restorable on
 * back-navigation (PRD 6.1 acceptance). It is a real `<form>` with a `GET`
 * action, so it still works before hydration.
 */

/** Budget bands in whole rupees; converted to minor units by the URL builder. */
const BUDGETS = [
  { value: '', label: 'Any budget' },
  { value: '0-50000', label: 'Under ₹50,000' },
  { value: '50000-200000', label: '₹50,000 – ₹2 lakh' },
  { value: '200000-500000', label: '₹2 – 5 lakh' },
  { value: '500000-1000000', label: '₹5 – 10 lakh' },
  { value: '1000000-', label: '₹10 lakh and above' },
]

const GUESTS = [
  { value: '', label: 'Any size' },
  { value: '50', label: 'Up to 50' },
  { value: '150', label: '50 – 150' },
  { value: '300', label: '150 – 300' },
  { value: '600', label: '300 – 600' },
  { value: '1000', label: '600+' },
]

function Field({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: typeof Search
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'group focus-within:ring-brand-300/60 focus-within:bg-brand-50/40 relative rounded-2xl px-4 py-3 transition-all focus-within:ring-2',
        className,
      )}
    >
      <span className="text-sand-500 mb-0.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
        <Icon aria-hidden="true" className="text-brand-500 size-3.5" />
        {label}
      </span>
      {children}
    </div>
  )
}

const CONTROL =
  'w-full bg-transparent text-sm font-medium text-sand-900 outline-none placeholder:text-sand-400'

export function HeroSearch({
  categories,
  cities,
  popular,
}: {
  categories: CategoryRow[]
  cities: CityRow[]
  popular: CategoryRow[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'vendors' | 'venues'>('vendors')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [budget, setBudget] = useState('')
  const [guests, setGuests] = useState('')
  const [date, setDate] = useState('')

  const venuesCategory = categories.find((item) => item.slug === 'venues')
  const effectiveCategory = tab === 'venues' ? (venuesCategory?.slug ?? category) : category

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const [min, max] = budget ? budget.split('-') : []
    router.push(
      buildSearchUrl({
        q: q || undefined,
        category: effectiveCategory || undefined,
        city: city || undefined,
        // Rupees → integer minor units (CLAUDE.md invariant 5).
        budgetMinMinor: min ? Number(min) * 100 : undefined,
        budgetMaxMinor: max ? Number(max) * 100 : undefined,
        eventDate: date || undefined,
        // Guest count is not a search filter yet; it is carried so the enquiry
        // form can prefill it once the customer picks a vendor.
        ...(guests ? { guestCount: guests } : {}),
      } as Parameters<typeof buildSearchUrl>[0]),
    )
  }

  return (
    <div className="w-full">
      {/* Tabs sit on top of the card, MakeMyTrip style. */}
      <div
        role="tablist"
        aria-label="What are you looking for?"
        className="flex w-fit gap-1 rounded-t-2xl bg-white/95 p-1.5 backdrop-blur"
      >
        {(
          [
            ['vendors', 'Find vendors', Tag],
            ['venues', 'Wedding venues', Building2],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === value
                ? 'brand-gradient text-white shadow-[var(--shadow-soft)]'
                : 'text-sand-600 hover:bg-sand-100',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        action="/vendors"
        method="get"
        className="rounded-2xl rounded-tl-none bg-white p-3 shadow-[var(--shadow-float)] sm:p-4"
      >
        <div className="grid gap-1 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
          <Field icon={Search} label="Search">
            <input
              type="search"
              name="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Name or keyword"
              aria-label="Search by name or keyword"
              className={CONTROL}
            />
          </Field>

          {tab === 'vendors' ? (
            <Field icon={Tag} label="Category" className="lg:border-sand-200 lg:border-l">
              <select
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Category"
                className={CONTROL}
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field icon={Users} label="Guests" className="lg:border-sand-200 lg:border-l">
              <select
                value={guests}
                onChange={(event) => setGuests(event.target.value)}
                aria-label="Approximate guest count"
                className={CONTROL}
              >
                {GUESTS.map((item) => (
                  <option key={item.label} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field icon={MapPin} label="City" className="lg:border-sand-200 lg:border-l">
            <select
              name="city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              aria-label="City"
              className={CONTROL}
            >
              <option value="">All cities</option>
              {cities.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field icon={IndianRupee} label="Budget" className="lg:border-sand-200 lg:border-l">
            <select
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              aria-label="Budget"
              className={CONTROL}
            >
              {BUDGETS.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field icon={CalendarDays} label="Date" className="lg:border-sand-200 lg:border-l">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Wedding date (optional)"
              className={CONTROL}
            />
          </Field>

          <button
            type="submit"
            className="brand-gradient group relative mt-2 inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl px-8 py-4 text-sm font-semibold text-white shadow-[var(--shadow-raised)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 lg:mt-0"
          >
            <Search aria-hidden="true" className="size-4" />
            <span className="relative z-10">Search</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/30 opacity-0 group-hover:opacity-100 motion-safe:group-hover:animate-[shimmer_1.2s_ease-out]"
            />
          </button>
        </div>
      </form>

      {popular.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-white/90">Popular searches:</span>
          {popular.map((item) => (
            <a
              key={item.id}
              href={`/vendors/${item.slug}`}
              className="rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
            >
              {item.name}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}
