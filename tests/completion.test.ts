import { describe, expect, it } from 'vitest'

import {
  calculateCompletion,
  nextAction,
  type CompletionInput,
} from '@/features/vendors/completion'

const EMPTY: CompletionInput = {
  displayName: null,
  primaryCityId: null,
  categoryCount: 0,
  serviceAreaCount: 0,
  about: null,
  experienceYears: null,
  phone: null,
  email: null,
  website: null,
  packageCount: 0,
  mediaCount: 0,
  documentCount: 0,
}

const COMPLETE: CompletionInput = {
  displayName: 'Marigold Courtyard',
  primaryCityId: '11111111-1111-1111-1111-111111111111',
  categoryCount: 1,
  serviceAreaCount: 2,
  about: 'x'.repeat(60),
  experienceYears: 12,
  phone: '+91 98765 43210',
  email: 'hello@example.test',
  website: 'https://example.test',
  packageCount: 2,
  mediaCount: 6,
  documentCount: 1,
}

describe('completion score', () => {
  it('scores an empty profile at zero and blocks submission', () => {
    const result = calculateCompletion(EMPTY)
    expect(result.score).toBe(0)
    expect(result.canSubmit).toBe(false)
    expect(result.missingRequired.length).toBeGreaterThan(0)
  })

  it('scores a complete profile at 100', () => {
    const result = calculateCompletion(COMPLETE)
    expect(result.score).toBe(100)
    expect(result.canSubmit).toBe(true)
    expect(result.missingRequired).toEqual([])
  })

  it('never exceeds 100 or drops below 0', () => {
    expect(calculateCompletion(COMPLETE).score).toBeLessThanOrEqual(100)
    expect(calculateCompletion(EMPTY).score).toBeGreaterThanOrEqual(0)
  })

  it('mirrors the SQL gate exactly', () => {
    // submit_vendor_for_review() blocks on these five and no others.
    const required = calculateCompletion(EMPTY)
      .fields.filter((f) => f.required)
      .map((f) => f.key)
      .sort()

    expect(required).toEqual(['about', 'categories', 'city', 'displayName', 'serviceAreas'])
  })

  it('treats an about under 50 characters as incomplete', () => {
    const result = calculateCompletion({ ...COMPLETE, about: 'Too short.' })
    expect(result.canSubmit).toBe(false)
    expect(result.missingRequired.map((f) => f.key)).toContain('about')
  })

  it('accepts an about of exactly 50 characters', () => {
    const result = calculateCompletion({ ...COMPLETE, about: 'x'.repeat(50) })
    expect(result.canSubmit).toBe(true)
  })

  it('ignores surrounding whitespace when judging the description', () => {
    const result = calculateCompletion({ ...COMPLETE, about: `   ${'x'.repeat(20)}   ` })
    expect(result.canSubmit).toBe(false)
  })

  it('does not block submission on optional fields', () => {
    const result = calculateCompletion({
      ...COMPLETE,
      packageCount: 0,
      mediaCount: 0,
      documentCount: 0,
      website: null,
      phone: null,
      email: null,
      experienceYears: null,
    })
    expect(result.canSubmit).toBe(true)
    expect(result.score).toBeLessThan(100)
    expect(result.score).toBeGreaterThan(0)
  })

  it('counts a blank display name as missing', () => {
    const result = calculateCompletion({ ...COMPLETE, displayName: '   ' })
    expect(result.canSubmit).toBe(false)
  })

  it('requires the recommended number of photos before crediting media', () => {
    expect(calculateCompletion({ ...COMPLETE, mediaCount: 2 }).score).toBeLessThan(100)
    expect(calculateCompletion({ ...COMPLETE, mediaCount: 3 }).score).toBe(100)
  })

  it('treats zero years in business as answered, not missing', () => {
    const result = calculateCompletion({ ...COMPLETE, experienceYears: 0 })
    expect(result.fields.find((f) => f.key === 'experience')?.done).toBe(true)
  })
})

describe('next recommended action', () => {
  it('prioritises a required field over a heavier optional one', () => {
    // `media` is weight 15, `city` only 8 — but city blocks submission.
    const result = calculateCompletion({ ...COMPLETE, primaryCityId: null, mediaCount: 0 })
    expect(nextAction(result)?.key).toBe('city')
  })

  it('falls back to the heaviest incomplete optional field', () => {
    const result = calculateCompletion({ ...COMPLETE, mediaCount: 0, website: null })
    expect(nextAction(result)?.key).toBe('media')
  })

  it('returns null when everything is done', () => {
    expect(nextAction(calculateCompletion(COMPLETE))).toBeNull()
  })
})
