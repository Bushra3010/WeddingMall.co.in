/**
 * All timestamps are stored UTC and displayed in the viewer's timezone
 * (PRD 3). `DEFAULT_TIMEZONE` is the fallback when a profile has none.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

export function formatDate(
  value: string | Date,
  timeZone = DEFAULT_TIMEZONE,
  locale = 'en-IN',
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone,
  }).format(new Date(value))
}

export function formatDateTime(
  value: string | Date,
  timeZone = DEFAULT_TIMEZONE,
  locale = 'en-IN',
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value))
}

/** Wedding dates may be a precise day or a flexible "2027-03" month. */
export function formatFlexibleMonth(value: string, locale = 'en-IN'): string {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, (month ?? 1) - 1, 1)))
}

export function formatWeddingWhen(
  weddingDate: string | null,
  flexibleMonth: string | null,
  locale = 'en-IN',
): string {
  if (weddingDate) return formatDate(weddingDate, 'UTC', locale)
  if (flexibleMonth) return `${formatFlexibleMonth(flexibleMonth, locale)} (flexible)`
  return 'Date not decided'
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const delta = new Date(value).getTime() - now.getTime()
  const abs = Math.abs(delta)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (abs < HOUR) return rtf.format(Math.round(delta / MINUTE), 'minute')
  if (abs < DAY) return rtf.format(Math.round(delta / HOUR), 'hour')
  if (abs < 30 * DAY) return rtf.format(Math.round(delta / DAY), 'day')
  return rtf.format(Math.round(delta / (30 * DAY)), 'month')
}

/** First-response SLA clock; starts at `delivered` (PRD 6.6). */
export function responseElapsedHours(deliveredAt: string, respondedAt?: string | null): number {
  const end = respondedAt ? new Date(respondedAt) : new Date()
  return (end.getTime() - new Date(deliveredAt).getTime()) / HOUR
}

export function isOverdue(deliveredAt: string, respondedAt: string | null, slaHours: number) {
  if (respondedAt) return false
  return responseElapsedHours(deliveredAt) > slaHours
}
