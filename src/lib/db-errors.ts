import { ServiceError } from '@/lib/action-result'

/**
 * Turns a Postgres error into something safe to show a person
 * (CLAUDE.md invariant 7: raw database errors must never reach a user).
 *
 * ## The distinction that matters
 *
 * `42501` arrives from two different places:
 *
 *   * **Postgres itself**, when RLS refuses a write — "new row violates
 *     row-level security policy for table \"messages\"". That names internal
 *     tables, tells the reader nothing they can act on, and reached a customer
 *     in production because the old helper preferred `error.message` over its
 *     own fallback.
 *   * **Our own triggers**, which `raise exception … using errcode = '42501'`
 *     with text written to be read — "Featured placement requires a plan that
 *     includes it", "Only a moderator may change review moderation state".
 *
 * Blanket-replacing 42501 would throw away the second kind; passing it through
 * leaks the first. So the built-in phrasings are matched explicitly and
 * everything else is assumed to be ours and deliberate.
 */
const POSTGRES_RLS_PHRASES = [
  'violates row-level security policy',
  'permission denied for table',
  'permission denied for relation',
  'permission denied for schema',
]

function isRawPostgresRefusal(message: string): boolean {
  const lower = message.toLowerCase()
  return POSTGRES_RLS_PHRASES.some((phrase) => lower.includes(phrase))
}

export interface DbErrorLike {
  code?: string
  message?: string
}

export function translateDbError(
  error: DbErrorLike | null,
  fallback: string,
  overrides: { forbidden?: string; conflict?: string; notFound?: string } = {},
): never {
  const message = error?.message ?? ''

  // Raised by our own PL/pgSQL with `raise exception`. These are written for
  // the person reading them, so they pass through.
  if (error?.code === 'P0001' || error?.code === 'P0002') {
    throw new ServiceError('invalid_state', message || fallback)
  }

  if (error?.code === '42501') {
    throw new ServiceError(
      'forbidden',
      isRawPostgresRefusal(message)
        ? (overrides.forbidden ?? 'You do not have permission to do that.')
        : message || (overrides.forbidden ?? 'You do not have permission to do that.'),
    )
  }

  if (error?.code === '23505') {
    throw new ServiceError('conflict', overrides.conflict ?? 'That has already been saved.')
  }

  if (error?.code === '23503') {
    throw new ServiceError('not_found', overrides.notFound ?? 'That record no longer exists.')
  }

  // Anything unrecognised is assumed to expose internals and is replaced.
  throw new ServiceError('internal_error', fallback)
}
