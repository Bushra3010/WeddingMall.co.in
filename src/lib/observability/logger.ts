/**
 * Structured logging with a correlation id (PRD 14.4).
 *
 * Values are redacted before serialisation: logs must never contain access
 * tokens, full document numbers, or unnecessary PII (PRD 10.1).
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const REDACT_KEYS =
  /^(password|token|access_token|refresh_token|authorization|api_?key|secret|otp|card|cvv|pan|aadhaar|gstin|document_number|phone|email)$/i

export function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        REDACT_KEYS.test(key) ? '[redacted]' : redact(item, depth + 1),
      ]),
    )
  }
  return value
}

function emit(level: Level, message: string, context: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...(redact(context) as Record<string, unknown>),
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
}

/**
 * Supabase and provider SDKs reject with plain objects rather than `Error`
 * instances, so `String(error)` would flatten them to "[object Object]" and
 * throw away the message and code. Keep the structure instead.
 */
function serialiseError(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  if (error !== null && typeof error === 'object') {
    return redact(error)
  }
  return String(error)
}

export function logError(scope: string, error: unknown, context: Record<string, unknown> = {}) {
  emit('error', scope, { ...context, error: serialiseError(error) })
  // Sentry adapter hooks in here once SENTRY_DSN is configured (PRD 8.1).
}
