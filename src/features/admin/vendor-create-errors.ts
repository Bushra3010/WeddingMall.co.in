/**
 * Turning a Postgres error from `admin_create_vendor()` into something a person
 * reads.
 *
 * Same shape and the same reasoning as {@link describeDeleteError}: the refusals
 * written in SQL are written *for an admin to read* — "The web address
 * 'lotus-events' is already used by another business", "No account exists for
 * x@y.com" — and saying what is in the way is the whole point, so those survive
 * intact. Everything else is Postgres talking about itself and must be replaced
 * before it reaches a screen (PRD 15).
 *
 * ## Why the code decides, never the text
 *
 * Matching on message text is how you end up forwarding a constraint name to a
 * user. Migration 0033 records that lesson from the other direction: 0032 raised
 * its refusal as `foreign_key_violation`, which Postgres also raises by itself,
 * so "our message" and "the database's message" were indistinguishable.
 *
 * `P0001` is `raise_exception`, the SQLSTATE `raise exception` uses when no
 * `errcode` is given. Postgres's own errors all carry specific SQLSTATEs, so a
 * P0001 arriving from this call came from a `raise` we wrote. `PT409` is
 * PostgREST's "respond 409" convention, a class Postgres never raises at all.
 *
 * Kept out of the action module so it can be tested directly: a `'use server'`
 * module may only export async functions.
 */

export type CreateFailure = { code: string; message: string; field?: string }

export function describeCreateVendorError(
  error: { code?: string | null; message?: string | null },
  fallback: string,
): CreateFailure {
  const code = error.code ?? ''
  const message = error.message ?? ''

  // The slug is taken. A conflict, and it points at one field the admin can fix.
  if (code === 'PT409' && message) {
    return { code: 'conflict', message, field: 'slug' }
  }

  // No account for the owner email given. Also one field, and the SQL message
  // already explains both ways out (ask them to sign up, or leave it blank).
  if (code === 'P0002' && message) {
    return { code: 'validation_error', message, field: 'ownerEmail' }
  }

  // Our own `raise exception` without an errcode — a validation refusal from
  // inside the function, phrased for the reader.
  if (code === 'P0001' && message) {
    return { code: 'validation_error', message }
  }

  if (code === '42501') {
    return {
      code: 'forbidden',
      message: 'Creating a business requires the vendor.verify permission.',
    }
  }

  /*
   * The function is not in the database.
   *
   * Deploys and migrations are separate manual steps in this project, so the
   * code routinely runs ahead of the schema and an admin will genuinely meet
   * this. PostgREST's own text names the function and its schema cache, which is
   * the database talking about itself, so only the classification survives.
   */
  if (code === 'PGRST202') {
    return {
      code: 'not_implemented',
      message:
        'Creating a business needs migration 0039, which has not been applied yet. Nothing was created.',
    }
  }

  /*
   * A unique violation that reached the table without going through the
   * function's own slug check — a race between two admins creating the same
   * slug at once. Still a conflict on the same field; the message is replaced
   * because Postgres wrote it about its own index.
   */
  if (code === '23505') {
    return {
      code: 'conflict',
      message: 'That web address was taken while you were filling this in. Try another.',
      field: 'slug',
    }
  }

  return { code: 'internal_error', message: fallback }
}
