import { describe, expect, it } from 'vitest'

import { exponentFor, formatMoney, formatRange, money, parseMajor, toMajor } from '@/lib/money'
import { formatWeddingWhen, isOverdue, responseElapsedHours } from '@/lib/dates'

describe('money', () => {
  it('rejects a non-integer minor amount', () => {
    expect(() => money(10.5, 'INR')).toThrow(TypeError)
  })

  it('rejects a malformed currency code', () => {
    expect(() => money(1000, 'rupees')).toThrow(TypeError)
  })

  it('knows non-hundredth minor units', () => {
    expect(exponentFor('INR')).toBe(2)
    expect(exponentFor('JPY')).toBe(0)
    expect(exponentFor('KWD')).toBe(3)
  })

  it('parses grouped user input without floating-point drift', () => {
    expect(parseMajor('1,25,000.50')).toEqual({ amountMinor: 12500050, currency: 'INR' })
    expect(parseMajor('0.07')).toEqual({ amountMinor: 7, currency: 'INR' })
    expect(parseMajor('1000', 'JPY')).toEqual({ amountMinor: 1000, currency: 'JPY' })
  })

  it('returns null for junk input', () => {
    expect(parseMajor('')).toBeNull()
    expect(parseMajor('abc')).toBeNull()
    expect(parseMajor('1.2.3')).toBeNull()
  })

  it('round-trips through major units', () => {
    expect(toMajor(money(4500000, 'INR'))).toBe(45000)
    expect(toMajor(money(1000, 'JPY'))).toBe(1000)
  })

  it('formats a currency amount', () => {
    expect(formatMoney(money(4500000, 'INR'))).toContain('45,000')
  })

  it('collapses a range whose bounds are equal', () => {
    const same = formatRange(money(500000), money(500000))
    expect(same).not.toContain('–')
  })

  it('falls back to a single bound when only one is set', () => {
    expect(formatRange(money(500000), null)).toBeTruthy()
    expect(formatRange(null, null)).toBeNull()
  })

  it('refuses to format a range across currencies', () => {
    expect(() => formatRange(money(100, 'INR'), money(100, 'USD'))).toThrow(TypeError)
  })
})

describe('wedding dates', () => {
  it('prefers an exact date', () => {
    expect(formatWeddingWhen('2027-02-14', null)).toContain('2027')
  })

  it('marks a flexible month as flexible', () => {
    const label = formatWeddingWhen(null, '2027-03')
    expect(label).toContain('March')
    expect(label).toContain('flexible')
  })

  it('handles an undecided date', () => {
    expect(formatWeddingWhen(null, null)).toBe('Date not decided')
  })
})

describe('response SLA', () => {
  const delivered = '2026-07-30T10:00:00.000Z'

  it('measures elapsed hours to the response', () => {
    expect(responseElapsedHours(delivered, '2026-07-30T14:00:00.000Z')).toBe(4)
  })

  it('is never overdue once answered', () => {
    expect(isOverdue(delivered, '2026-07-30T10:30:00.000Z', 1)).toBe(false)
  })

  it('is overdue when unanswered past the threshold', () => {
    // `delivered` is well in the past relative to any test run.
    expect(isOverdue(delivered, null, 24)).toBe(true)
  })
})
