/**
 * Turning a Postgres error from a `delete_*()` function into something a person
 * reads.
 *
 * The distinction that matters: the refusal messages are written by us, in SQL,
 * for an admin to read — "Mumbai is still in use (3 vendors based there…)" —
 * and must survive intact, because saying what is in the way is the entire
 * point. Everything else is Postgres talking about itself and must be replaced,
 * or a raw database error reaches the screen (PRD 15).
 *
 * The codes make that call, not the text. `PTxxx` is PostgREST's convention for
 * "respond with HTTP xxx" and is a class Postgres never raises on its own, so a
 * PT code is proof the message came from one of our functions. Keying on a
 * shared code instead — 0032 used `foreign_key_violation` — would have
 * forwarded a real constraint violation, constraint name and all, as if we had
 * written it.
 *
 * Kept out of the action modules so it can be tested directly: a `'use server'`
 * module may only export async functions.
 */

export type DeleteFailure = { code: string; message: string }

/** Raised only by our own `delete_*()` functions, so the message is ours. */
const OURS = new Set(['PT409', 'PT404'])

export function describeDeleteError(
  error: { code?: string | null; message?: string | null },
  fallback: string,
): DeleteFailure {
  const code = error.code ?? ''

  if (OURS.has(code) && error.message) {
    return { code: 'conflict', message: error.message }
  }

  // Raised when the delete matched no rows. Under SECURITY INVOKER that means
  // RLS filtered it, so "something went wrong" would be a lie an admin could
  // waste an afternoon on.
  if (code === 'PT403' || code === '42501') {
    return { code: 'forbidden', message: 'You do not have permission to do that.' }
  }

  /*
   * The function is not in the database.
   *
   * PostgREST answers an unknown RPC with 404 PGRST202, which fell through to
   * the generic "something went wrong on our side" — and that is the one
   * message that cannot be acted on. Deploys and migrations are separate manual
   * steps in this project, so the code routinely runs ahead of the schema and
   * this is a state an admin will actually meet. Naming it turns a support
   * ticket into a one-line fix.
   *
   * Our own wording, not PostgREST's: the raw text names the function and the
   * schema cache, which is the database talking about itself (PRD 15).
   */
  if (code === 'PGRST202') {
    return {
      code: 'not_implemented',
      message:
        'This needs a database migration that has not been applied yet. Nothing was deleted.',
    }
  }

  /*
   * A real constraint violation — something reached the table without going
   * through the function. Still a conflict, but Postgres wrote this message
   * about its own schema, so only the classification survives.
   */
  if (code === '23503') {
    return { code: 'conflict', message: 'That is still in use, so it cannot be deleted.' }
  }

  return { code: 'internal_error', message: fallback }
}
