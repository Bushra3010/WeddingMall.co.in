import Link from 'next/link'
import { Check, ChevronDown, MapPin, Star, SlidersHorizontal, Grid3x3, IndianRupee } from 'lucide-react'

import { buildSearchUrl, type SearchFilters } from '@/features/search/filters'
import { cn } from '@/lib/utils'
import type { AttributeDefinition, CityRow } from '@/server/dal/taxonomy'

/**
 * The category page's filter row (PRD 6.2).
 *
 * Replaces a stacked panel that ran to eight labelled groups and pushed the
 * first result off the screen. Each group is a `<details>` disclosure rather
 * than a scripted menu, so every option stays a plain link and the page keeps
 * working with no client JavaScript — the same contract the filters had when
 * they were a list. What it costs is closing on an outside click, which a
 * disclosure cannot do without script.
 *
 * A pill that has something applied says so: it carries the chosen value, or a
 * count when several are on, so the state of a search is legible without
 * opening anything.
 */

/** Upper bounds in minor units, so the labels match `lib/money`'s convention. */
const BUDGET_STEPS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹1 lakh', max: 10_000_000 },
  { label: '₹1–3 lakh', min: 10_000_000, max: 30_000_000 },
  { label: '₹3–5 lakh', min: 30_000_000, max: 50_000_000 },
  { label: '₹5 lakh and above', min: 50_000_000 },
]

const RATING_STEPS = [
  { label: '4.5 and above', value: 4.5 },
  { label: '4.0 and above', value: 4 },
  { label: '3.0 and above', value: 3 },
] as const

function Pill({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: typeof MapPin
  label: string
  /** The applied selection, shown in place of the label once something is on. */
  value?: string | null
  children: React.ReactNode
}) {
  const active = Boolean(value)

  return (
    <details className="group relative">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors [&::-webkit-details-marker]:hidden',
          active
            ? 'border-brand-600 bg-brand-50 text-brand-800 font-medium'
            : 'border-sand-200 bg-sand-50 text-sand-700 hover:border-sand-300',
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {value ?? label}
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="border-sand-200 absolute top-full left-0 z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-[var(--radius-card)] border bg-white p-2 shadow-[var(--shadow-float)]">
        {children}
      </div>
    </details>
  )
}

function Option({
  href,
  selected,
  children,
}: {
  href: string
  selected: boolean
  children: React.ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
          selected ? 'bg-brand-50 text-brand-800 font-medium' : 'text-sand-700 hover:bg-sand-50',
        )}
      >
        {children}
        {selected ? <Check aria-hidden="true" className="text-brand-700 size-4 shrink-0" /> : null}
      </Link>
    </li>
  )
}

export function FilterBar({
  filters,
  basePath,
  cities,
  attributes,
  categorySlug,
  className,
}: {
  filters: SearchFilters
  basePath: string
  cities: CityRow[]
  attributes: AttributeDefinition[]
  categorySlug: string
  className?: string
}) {
  const choiceAttributes = attributes.filter(
    (a) =>
      (a.inputType === 'select' || a.inputType === 'multiselect' || a.inputType === 'boolean') &&
      (a.options.length > 0 || a.inputType === 'boolean'),
  )

  /** Mirrors `AttributeFilters`: a value already on is removed by its own link. */
  function toggleAttribute(code: string, value: string): string {
    const current = filters.attributes[code] ?? []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]

    const attributes = { ...filters.attributes }
    if (next.length === 0) delete attributes[code]
    else attributes[code] = next

    return buildSearchUrl({ ...filters, attributes, page: 1 }, basePath)
  }

  const appliedAttributes = Object.values(filters.attributes).flat().length
  const budget = BUDGET_STEPS.find(
    (step) => step.min === filters.budgetMinMinor && step.max === filters.budgetMaxMinor,
  )
  const city = cities.find((c) => c.slug === filters.city)

  const anythingApplied =
    Boolean(budget) ||
    Boolean(filters.minRating) ||
    filters.verifiedOnly ||
    appliedAttributes > 0 ||
    Boolean(filters.city)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Pill
        icon={SlidersHorizontal}
        label="Filters"
        value={filters.verifiedOnly ? 'Verified only' : null}
      >
        <ul>
          <Option
            href={buildSearchUrl(
              { ...filters, verifiedOnly: !filters.verifiedOnly, page: 1 },
              basePath,
            )}
            selected={filters.verifiedOnly}
          >
            Verified businesses only
          </Option>
          {anythingApplied ? (
            <li className="border-sand-100 mt-1 border-t pt-1">
              <Link
                href={basePath}
                className="text-brand-700 hover:bg-sand-50 block rounded-lg px-3 py-2 text-sm font-medium"
              >
                Clear all filters
              </Link>
            </li>
          ) : null}
        </ul>
      </Pill>

      <Pill icon={IndianRupee} label="Budget" value={budget?.label}>
        <ul>
          {BUDGET_STEPS.map((step) => {
            const selected = budget?.label === step.label
            return (
              <Option
                key={step.label}
                selected={selected}
                href={buildSearchUrl(
                  {
                    ...filters,
                    budgetMinMinor: selected ? undefined : step.min,
                    budgetMaxMinor: selected ? undefined : step.max,
                    page: 1,
                  },
                  basePath,
                )}
              >
                {step.label}
              </Option>
            )
          })}
        </ul>
      </Pill>

      {cities.length > 0 ? (
        <Pill icon={MapPin} label="Location" value={city?.name}>
          {/*
            These point at the dedicated city pages rather than adding `?city=`
            to this one. Those pages carry their own copy and metadata and are
            what search engines are meant to index (PRD 11.2); routing the
            control through a query parameter would quietly strand them.
          */}
          <ul>
            {cities.map((row) => (
              <Option
                key={row.id}
                href={`/vendors/${categorySlug}/${row.slug}`}
                selected={row.slug === filters.city}
              >
                {row.name}
              </Option>
            ))}
          </ul>
        </Pill>
      ) : null}

      <Pill
        icon={Star}
        label="Ratings"
        value={filters.minRating ? `${filters.minRating}★ and above` : null}
      >
        <ul>
          {RATING_STEPS.map((step) => {
            const selected = filters.minRating === step.value
            return (
              <Option
                key={step.value}
                selected={selected}
                href={buildSearchUrl(
                  { ...filters, minRating: selected ? undefined : step.value, page: 1 },
                  basePath,
                )}
              >
                {step.label}
              </Option>
            )
          })}
        </ul>
      </Pill>

      {choiceAttributes.length > 0 ? (
        <Pill
          icon={Grid3x3}
          label="Services"
          value={appliedAttributes > 0 ? `${appliedAttributes} selected` : null}
        >
          <div className="space-y-3">
            {choiceAttributes.map((attribute) => {
              const options = attribute.inputType === 'boolean' ? ['true'] : attribute.options
              const applied = filters.attributes[attribute.code] ?? []

              return (
                <div key={attribute.id}>
                  <p className="text-sand-500 px-3 pt-1 text-[11px] font-medium tracking-wide uppercase">
                    {attribute.label}
                  </p>
                  <ul>
                    {options.map((option) => (
                      <Option
                        key={option}
                        href={toggleAttribute(attribute.code, option)}
                        selected={applied.includes(option)}
                      >
                        {attribute.inputType === 'boolean' ? attribute.label : option}
                      </Option>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </Pill>
      ) : null}
    </div>
  )
}
