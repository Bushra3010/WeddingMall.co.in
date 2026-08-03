import { describe, expect, it } from 'vitest'

import { describeDeleteCityError } from '@/features/taxonomy/delete-errors'

/**
 * The refusal message is the feature. A delete that is blocked because three
 * vendors cover the city is only useful if it says so — replacing it with a
 * generic apology would leave an admin clicking the same button forever.
 *
 * The mirror of that: anything Postgres wrote about itself has to be replaced,
 * because it names tables and constraints. This is the same split that let a
 * raw RLS error reach a customer's screen once already (see `lib/db-errors`).
 */
describe('describeDeleteCityError', () => {
  it('passes through the in-use refusal, which we author in SQL', () => {
    const result = describeDeleteCityError({
      code: 'PT409',
      message:
        'Mumbai is still in use (3 vendors based there). Hide it instead — that removes it from public filters and keeps the links working.',
    })

    expect(result.code).toBe('conflict')
    expect(result.message).toContain('3 vendors based there')
  })

  it('passes through the already-deleted message', () => {
    const result = describeDeleteCityError({
      code: 'PT404',
      message: 'That city no longer exists.',
    })

    expect(result).toEqual({ code: 'conflict', message: 'That city no longer exists.' })
  })

  it('reports a permission failure as forbidden, not as a server fault', () => {
    // Under SECURITY INVOKER a delete that matches no rows means RLS filtered
    // it, so telling the admin "something went wrong" would be a lie they
    // could waste an afternoon on.
    for (const code of ['PT403', '42501']) {
      expect(describeDeleteCityError({ code, message: 'permission denied' })).toEqual({
        code: 'forbidden',
        message: 'You do not have permission to delete that city.',
      })
    }
  })

  it('replaces a raw constraint violation that reached the table directly', () => {
    // Same 23503, but PostgREST's own wording rather than ours: it names the
    // constraint and the child table, so it must not be shown.
    const result = describeDeleteCityError({
      code: '23503',
      message:
        'update or delete on table "cities" violates foreign key constraint "vendor_service_areas_city_id_fkey" on table "vendor_service_areas"',
    })

    expect(result.code).toBe('conflict')
    expect(result.message).not.toContain('vendor_service_areas_city_id_fkey')
  })

  it('replaces anything else, including an error with no code at all', () => {
    for (const error of [
      { code: '42P01', message: 'relation "cities" does not exist' },
      { code: null, message: 'fetch failed' },
      { code: undefined, message: undefined },
    ]) {
      const result = describeDeleteCityError(error)
      expect(result.code).toBe('internal_error')
      expect(result.message).toBe('We could not delete that city.')
    }
  })
})
