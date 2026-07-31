import { describe, expect, it } from 'vitest'

import { availabilitySchema, linesToList, packageSchema } from '@/features/listings/schema'
import { buildSearchUrl, parseSearchParams } from '@/features/search/filters'

const BASE = {
  name: 'Single day coverage',
  priceType: 'starting_at' as const,
  minAmount: 125000,
  currency: 'INR',
  inclusions: [],
  exclusions: [],
  active: true,
  sortOrder: 0,
}

describe('package pricing rules', () => {
  it('accepts a starting price', () => {
    expect(packageSchema.safeParse(BASE).success).toBe(true)
  })

  it('requires a price unless the type is "on request"', () => {
    const result = packageSchema.safeParse({ ...BASE, minAmount: undefined })
    expect(result.success).toBe(false)
  })

  it('allows "on request" with no price at all', () => {
    const result = packageSchema.safeParse({
      ...BASE,
      priceType: 'custom',
      minAmount: undefined,
    })
    expect(result.success).toBe(true)
  })

  it('requires both bounds for a range', () => {
    const missing = packageSchema.safeParse({ ...BASE, priceType: 'range' })
    expect(missing.success).toBe(false)

    const complete = packageSchema.safeParse({
      ...BASE,
      priceType: 'range',
      minAmount: 100000,
      maxAmount: 200000,
    })
    expect(complete.success).toBe(true)
  })

  it('rejects an inverted range', () => {
    const result = packageSchema.safeParse({
      ...BASE,
      priceType: 'range',
      minAmount: 200000,
      maxAmount: 100000,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a range whose bounds are equal', () => {
    const result = packageSchema.safeParse({
      ...BASE,
      priceType: 'range',
      minAmount: 100000,
      maxAmount: 100000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a nameless package', () => {
    expect(packageSchema.safeParse({ ...BASE, name: ' ' }).success).toBe(false)
  })
})

describe('availability rules', () => {
  const valid = { startDate: '2027-02-01', endDate: '2027-02-03', status: 'unavailable' as const }

  it('accepts a normal range', () => {
    expect(availabilitySchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a single day', () => {
    expect(availabilitySchema.safeParse({ ...valid, endDate: valid.startDate }).success).toBe(true)
  })

  it('rejects an end date before the start', () => {
    const result = availabilitySchema.safeParse({ ...valid, endDate: '2027-01-01' })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed date', () => {
    expect(availabilitySchema.safeParse({ ...valid, startDate: '01/02/2027' }).success).toBe(false)
  })
})

describe('one-per-line lists', () => {
  it('trims and drops blanks', () => {
    expect(linesToList('  Album \n\n  Drone \n')).toEqual(['Album', 'Drone'])
  })

  it('caps the list', () => {
    expect(linesToList(Array.from({ length: 50 }, (_, i) => `item ${i}`).join('\n'))).toHaveLength(
      30,
    )
  })

  it('returns nothing for empty input', () => {
    expect(linesToList('   \n  ')).toEqual([])
  })
})

describe('attribute filters in the URL', () => {
  it('parses repeated attribute parameters into a list', () => {
    const filters = parseSearchParams({ attr_venue_type: ['Hotel', 'Resort'] })
    expect(filters.attributes).toEqual({ venue_type: ['Hotel', 'Resort'] })
  })

  it('parses a single attribute value', () => {
    expect(parseSearchParams({ attr_cuisine: 'Jain' }).attributes).toEqual({ cuisine: ['Jain'] })
  })

  it('ignores an attribute parameter with no code', () => {
    expect(parseSearchParams({ attr_: 'x' }).attributes).toEqual({})
  })

  it('keeps ordinary filters separate from attributes', () => {
    const filters = parseSearchParams({ city: 'jaipur', attr_capacity: '400' })
    expect(filters.city).toBe('jaipur')
    expect(filters.attributes).toEqual({ capacity: ['400'] })
  })

  it('round-trips through buildSearchUrl', () => {
    const filters = parseSearchParams({
      attr_venue_type: ['Hotel', 'Resort'],
      attr_parking: 'true',
    })
    const url = buildSearchUrl({ ...filters, category: 'venues' })
    const parsed = parseSearchParams(
      Object.fromEntries(
        [...new URL(url, 'http://x').searchParams.keys()].map((key) => [
          key,
          new URL(url, 'http://x').searchParams.getAll(key),
        ]),
      ),
    )
    expect(parsed.attributes).toEqual({ venue_type: ['Hotel', 'Resort'], parking: ['true'] })
  })

  it('counts each attribute as one active filter', () => {
    const filters = parseSearchParams({ attr_a: ['1', '2'], attr_b: '3' })
    // Two codes, three values — two filters from the customer's point of view.
    expect(Object.keys(filters.attributes)).toHaveLength(2)
  })

  it('defaults to no attribute filters', () => {
    expect(parseSearchParams({}).attributes).toEqual({})
  })
})
