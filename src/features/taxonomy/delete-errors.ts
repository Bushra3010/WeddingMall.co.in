/**
 * Turning a Postgres error from `delete_city()` into something a person reads.
 *
 * The distinction that matters: two of these messages are written by us, in
 * SQL, for an admin to read — "Mumbai is still in use (3 vendors based there…)"
 * — and must survive intact, because the whole point of the refusal is saying
 * what is in the way. Everything else is Postgres talking about itself and must
 * be replaced, or a raw database error reaches the screen (PRD 15).
 *
 * Kept apart from `actions.ts` so it can be tested directly: a `'use server'`
 * module may only export async functions.
 */

export type DeleteFailure = { code: string; message: string }

/**
 * Codes only `delete_city()` raises, so its message is known to be ours.
 *
 * These were `23503`/`P0002` in migration 0032, which was wrong: Postgres
 * raises 23503 itself when a constraint is hit directly, and that message names
 * the constraint and the child table. Keying on a shared code meant a database
 * error would have been forwarded to the screen as if we had written it.
 * Migration 0033 moved to `PTxxx`, which Postgres never raises.
 */
const OURS = new Set(['PT409', 'PT404'])

export function describeDeleteCityError(error: {
  code?: string | null
  message?: string | null
}): DeleteFailure {
  const code = error.code ?? ''

  if (OURS.has(code) && error.message) {
    return { code: 'conflict', message: error.message }
  }

  // Raised when the delete matched no rows. Under SECURITY INVOKER that means
  // RLS filtered it, so "something went wrong" would be a lie an admin could
  // waste an afternoon on.
  if (code === 'PT403' || code === '42501') {
    return { code: 'forbidden', message: 'You do not have permission to delete that city.' }
  }

  /*
   * A real constraint violation — something reached the table without going
   * through the function. Still a conflict, but Postgres wrote this message
   * about its own schema, so only the classification survives.
   */
  if (code === '23503') {
    return {
      code: 'conflict',
      message: 'That city is still in use, so it cannot be deleted. Hide it instead.',
    }
  }

  return { code: 'internal_error', message: 'We could not delete that city.' }
}
