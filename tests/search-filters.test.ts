import { describe, expect, it } from 'vitest'

import {
  activeFilterCount,
  buildSearchUrl,
  parseSearchParams,
  searchFiltersSchema,
} from '@/features/search/filters'

describe('search filter parsing', () => {
  it('applies defaults for an empty query string', () => {
    const filters = parseSearchParams({})
    expect(filters.sort).toBe('recommended')
    expect(filters.page).toBe(1)
    expect(filters.limit).toBe(24)
    expect(filters.verifiedOnly).toBe(false)
  })

  it('falls back rather than throwing on a malformed parameter', () => {
    const filters = parseSearchParams({ sort: 'nonsense', page: 'abc', minRating: '99' })
    expect(filters.sort).toBe('recommended')
    expect(filters.page).toBe(1)
    expect(filters.minRating).toBeUndefined()
  })

  it('takes the first value of a repeated parameter', () => {
    expect(parseSearchParams({ city: ['mumbai', 'pune'] }).city).toBe('mumbai')
  })

  it('caps limit so a caller cannot request an unbounded page', () => {
    expect(searchFiltersSchema.parse({ limit: 5000 }).limit).toBe(24)
  })

  it('caps page depth', () => {
    expect(searchFiltersSchema.parse({ page: 100000 }).page).toBe(1)
  })
})

describe('canonical search URLs', () => {
  it('uses the bare path when nothing is set', () => {
    expect(buildSearchUrl({})).toBe('/vendors')
  })

  it('omits parameters that equal their default', () => {
    expect(buildSearchUrl({ sort: 'recommended', page: 1 })).toBe('/vendors')
  })

  it('promotes category to a path segment', () => {
    expect(buildSearchUrl({ category: 'photographers' })).toBe('/vendors/photographers')
  })

  it('promotes category and city to path segments', () => {
    expect(buildSearchUrl({ category: 'photographers', city: 'jaipur' })).toBe(
      '/vendors/photographers/jaipur',
    )
  })

  it('keeps remaining filters in the query string', () => {
    const url = buildSearchUrl({ category: 'venues', city: 'goa', sort: 'rating', minRating: 4 })
    expect(url).toContain('/vendors/venues/goa?')
    expect(url).toContain('sort=rating')
    expect(url).toContain('minRating=4')
  })

  it('keeps city as a query parameter when no category is chosen', () => {
    expect(buildSearchUrl({ city: 'delhi' })).toBe('/vendors?city=delhi')
  })
})

describe('active filter count', () => {
  it('counts nothing for a default search', () => {
    expect(activeFilterCount(parseSearchParams({}))).toBe(0)
  })

  it('counts a budget range once', () => {
    const filters = parseSearchParams({ budgetMinMinor: '10000', budgetMaxMinor: '90000' })
    expect(activeFilterCount(filters)).toBe(1)
  })

  it('counts each distinct filter', () => {
    const filters = parseSearchParams({
      q: 'candid',
      city: 'jaipur',
      category: 'photographers',
      verifiedOnly: 'true',
    })
    expect(activeFilterCount(filters)).toBe(4)
  })
})
