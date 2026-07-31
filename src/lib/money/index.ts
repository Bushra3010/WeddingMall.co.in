/**
 * Money is stored as integer minor units plus an ISO 4217 code (PRD 3, 9).
 * Never use floating point for amounts.
 */

export interface Money {
  amountMinor: number
  currency: string
}

/** Currencies whose minor unit is not 1/100. Extend as markets are added. */
const EXPONENTS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
}

export function exponentFor(currency: string): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2
}

export function money(amountMinor: number, currency = 'INR'): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new TypeError(`amountMinor must be an integer, received ${amountMinor}`)
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new TypeError(`currency must be a 3-letter ISO code, received "${currency}"`)
  }
  return { amountMinor, currency }
}

/** Parse user input ("1,25,000.50") into minor units. Returns null if invalid. */
export function parseMajor(input: string, currency = 'INR'): Money | null {
  const cleaned = input.replace(/[\s,]/g, '')
  if (cleaned === '' || !/^-?\d*(\.\d+)?$/.test(cleaned)) return null
  const exponent = exponentFor(currency)
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null
  const minor = Math.round(value * 10 ** exponent)
  return money(minor, currency)
}

export function toMajor({ amountMinor, currency }: Money): number {
  return amountMinor / 10 ** exponentFor(currency)
}

export function formatMoney(
  value: Money,
  locale = 'en-IN',
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    maximumFractionDigits: exponentFor(value.currency),
    ...options,
  }).format(toMajor(value))
}

/** "From ₹45,000" style label used on listing cards and packages (PRD 6.3). */
export function formatStartingPrice(value: Money | null, locale = 'en-IN'): string | null {
  if (!value) return null
  return formatMoney(value, locale, { maximumFractionDigits: 0 })
}

export function formatRange(min: Money | null, max: Money | null, locale = 'en-IN'): string | null {
  if (min && max) {
    if (min.currency !== max.currency) {
      throw new TypeError('Cannot format a range across different currencies')
    }
    if (min.amountMinor === max.amountMinor) return formatMoney(min, locale)
    return `${formatMoney(min, locale, { maximumFractionDigits: 0 })} – ${formatMoney(max, locale, { maximumFractionDigits: 0 })}`
  }
  return formatStartingPrice(min ?? max, locale)
}
