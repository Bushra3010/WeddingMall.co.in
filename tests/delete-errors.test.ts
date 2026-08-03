import { describe, expect, it } from 'vitest'

import { describeDeleteError } from '@/features/admin/delete-errors'

/**
 * The refusal message is the feature. A delete blocked because three vendors
 * cover a city is only useful if it says so — replacing it with a generic
 * apology would leave an admin clicking the same button forever.
 *
 * The mirror of that: anything Postgres wrote about itself has to be replaced,
 * because it names tables and constraints. This is the same split that let a raw
 * RLS error reach a customer's screen once already (see `lib/db-errors`), and
 * the first version of this mapper got it wrong in exactly that way — it keyed
 * on `23503`, a code Postgres also raises, so a real constraint violation would
 * have been forwarded verbatim.
 */
describe('describeDeleteError', () => {
  const FALLBACK = 'We could not delete that city.'

  it('passes through a refusal we author in SQL', () => {
    const result = describeDeleteError(
      {
        code: 'PT409',
        message:
          'Mumbai is still in use (3 vendors based there). Hide it instead — that removes it from public filters and keeps the links working.',
      },
      FALLBACK,
    )

    expect(result.code).toBe('conflict')
    expect(result.message).toContain('3 vendors based there')
  })

  it('passes through the already-deleted message', () => {
    expect(
      describeDeleteError({ code: 'PT404', message: 'That plan no longer exists.' }, FALLBACK),
    ).toEqual({ code: 'conflict', message: 'That plan no longer exists.' })
  })

  it('reports a permission failure as forbidden, not as a server fault', () => {
    // Under SECURITY INVOKER a delete matching no rows means RLS filtered it,
    // so "something went wrong" would be a lie an admin could waste an
    // afternoon on.
    for (const code of ['PT403', '42501']) {
      expect(describeDeleteError({ code, message: 'permission denied' }, FALLBACK)).toEqual({
        code: 'forbidden',
        message: 'You do not have permission to do that.',
      })
    }
  })

  it('replaces a raw constraint violation that reached the table directly', () => {
    const result = describeDeleteError(
      {
        code: '23503',
        message:
          'update or delete on table "cities" violates foreign key constraint "vendor_service_areas_city_id_fkey" on table "vendor_service_areas"',
      },
      FALLBACK,
    )

    expect(result.code).toBe('conflict')
    expect(result.message).not.toContain('vendor_service_areas_city_id_fkey')
    expect(result.message).not.toContain('violates')
  })

  it('never leaks a message it did not author, whatever the code', () => {
    for (const error of [
      { code: '42P01', message: 'relation "cities" does not exist' },
      { code: '42883', message: 'function public.delete_city(uuid) does not exist' },
      { code: null, message: 'fetch failed' },
      { code: undefined, message: undefined },
    ]) {
      const result = describeDeleteError(error, FALLBACK)
      expect(result.code).toBe('internal_error')
      expect(result.message).toBe(FALLBACK)
    }
  })

  it('uses the caller-supplied fallback, so each screen names its own thing', () => {
    expect(describeDeleteError({ code: '42P01' }, 'We could not delete that plan.').message).toBe(
      'We could not delete that plan.',
    )
  })

  it('will not pass through a PT code with an empty message', () => {
    // An empty refusal tells an admin nothing; the fallback at least names the
    // operation that failed.
    expect(describeDeleteError({ code: 'PT409', message: '' }, FALLBACK).message).toBe(FALLBACK)
  })
})
