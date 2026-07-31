import { z } from 'zod'

/**
 * Search filter contract (PRD 6.2). Filters live in URL query parameters so
 * that a search is shareable, indexable where appropriate, and restorable on
 * back-navigation.
 */

export const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'most_reviewed', label: 'Most reviewed' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]['value']

const optionalTrimmed = z.string().trim().min(1).max(120).optional().catch(undefined)

export const searchFiltersSchema = z.object({
  q: optionalTrimmed,
  category: optionalTrimmed,
  city: optionalTrimmed,
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  minRating: z.coerce.number().min(0).max(5).optional().catch(undefined),
  verifiedOnly: z.coerce.boolean().default(false).catch(false),
  budgetMinMinor: z.coerce.number().int().min(0).optional().catch(undefined),
  budgetMaxMinor: z.coerce.number().int().min(0).optional().catch(undefined),
  sort: z
    .enum(SORT_OPTIONS.map((option) => option.value) as [SortOption, ...SortOption[]])
    .default('recommended')
    .catch('recommended'),
  page: z.coerce.number().int().min(1).max(100).default(1).catch(1),
  /**
   * Category-specific attribute filters (PRD 6.2). Carried in the URL as
   * `attr_<code>=value` and repeated for multiple accepted values, so a search
   * stays shareable and back-navigable like every other filter.
   */
  attributes: z.record(z.string(), z.array(z.string())).default({}).catch({}),
  limit: z.coerce.number().int().min(1).max(60).default(24).catch(24),
})

export type SearchFilters = z.infer<typeof searchFiltersSchema>

/**
 * Parses `searchParams` leniently: an unknown or malformed parameter falls back
 * to its default rather than erroring the page (`.catch()` above).
 */
export const ATTRIBUTE_PREFIX = 'attr_'

export function parseSearchParams(
  params: Record<string, string | string[] | undefined>,
): SearchFilters {
  const flat: Record<string, unknown> = {}
  const attributes: Record<string, string[]> = {}

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (key.startsWith(ATTRIBUTE_PREFIX)) {
      const code = key.slice(ATTRIBUTE_PREFIX.length)
      const values = (Array.isArray(value) ? value : [value]).filter(Boolean)
      if (code && values.length > 0) attributes[code] = values
      continue
    }
    flat[key] = Array.isArray(value) ? value[0] : value
  }

  flat.attributes = attributes
  return searchFiltersSchema.parse(flat)
}

/** Canonical search URL — the hero form and every filter control build this. */
export function buildSearchUrl(filters: Partial<SearchFilters>, base = '/vendors'): string {
  const params = new URLSearchParams()
  const defaults: Record<string, unknown> = {
    sort: 'recommended',
    page: 1,
    limit: 24,
    verifiedOnly: false,
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    if (key === 'attributes') continue
    if (defaults[key] !== undefined && defaults[key] === value) continue
    params.set(key, String(value))
  }

  for (const [code, values] of Object.entries(filters.attributes ?? {})) {
    for (const value of values) params.append(`${ATTRIBUTE_PREFIX}${code}`, value)
  }

  // Category and city are path segments on the canonical SEO route.
  if (filters.category && filters.city) {
    params.delete('category')
    params.delete('city')
    const query = params.toString()
    return `/vendors/${filters.category}/${filters.city}${query ? `?${query}` : ''}`
  }
  if (filters.category) {
    params.delete('category')
    const query = params.toString()
    return `/vendors/${filters.category}${query ? `?${query}` : ''}`
  }

  const query = params.toString()
  return `${base}${query ? `?${query}` : ''}`
}

export function activeFilterCount(filters: SearchFilters): number {
  let count = 0
  if (filters.q) count++
  if (filters.city) count++
  if (filters.category) count++
  if (filters.minRating) count++
  if (filters.verifiedOnly) count++
  if (filters.budgetMinMinor || filters.budgetMaxMinor) count++
  if (filters.eventDate) count++
  count += Object.keys(filters.attributes ?? {}).length
  return count
}
