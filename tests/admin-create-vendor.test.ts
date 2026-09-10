import { describe, expect, it } from 'vitest'

import { describeCreateVendorError } from '@/features/admin/vendor-create-errors'
import { adminCreateVendorSchema } from '@/features/vendors/schema'

/**
 * Creating a business from the admin panel (migration 0039).
 *
 * Two things are pinned here. The publish rule has to match the floor
 * `admin_create_vendor()` applies in SQL, or the admin path becomes a way past
 * a gate every vendor has to clear. And the error mapper has to keep telling
 * *our* refusals apart from Postgres's, because forwarding the wrong one puts a
 * constraint name on an admin's screen (PRD 15).
 */

const BASE = {
  displayName: 'Marigold Courtyard',
  slug: 'marigold-courtyard',
  primaryCategoryId: '3f1c8a2e-7b4d-4c6a-9e1f-2a5b8c0d4e7f',
  primaryCityId: '9a2b1c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
  about: '',
  email: '',
  phone: '',
  website: '',
  ownerEmail: '',
  publish: false,
}

describe('adminCreateVendorSchema', () => {
  it('accepts a draft with nothing but the four required fields', () => {
    // A business taken down over the phone is often just a name, a category and
    // a city. Forcing a description before it can be saved as a draft would
    // mean inventing one.
    expect(adminCreateVendorSchema.safeParse(BASE).success).toBe(true)
  })

  it('refuses to publish without a description, at the SQL floor', () => {
    const result = adminCreateVendorSchema.safeParse({ ...BASE, publish: true })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['about'])

    const stub = adminCreateVendorSchema.safeParse({
      ...BASE,
      publish: true,
      about: 'Lovely venue.',
    })
    expect(stub.success).toBe(false)
  })

  it('publishes with a description at exactly the SQL floor', () => {
    expect(
      adminCreateVendorSchema.safeParse({ ...BASE, publish: true, about: 'x'.repeat(50) }).success,
    ).toBe(true)
  })

  it('treats a blank owner email as "the admin holds it"', () => {
    // Distinct from a *wrong* one, which the function refuses outright rather
    // than falling back to the creator.
    expect(adminCreateVendorSchema.parse(BASE).ownerEmail).toBe('')
    expect(adminCreateVendorSchema.safeParse({ ...BASE, ownerEmail: 'not-an-email' }).success).toBe(
      false,
    )
  })

  it('refuses a slug that would not survive as a URL', () => {
    for (const slug of ['Marigold Courtyard', 'marigold_courtyard', '-marigold', 'ab']) {
      expect(adminCreateVendorSchema.safeParse({ ...BASE, slug }).success, slug).toBe(false)
    }
  })

  it('drops anything that decides verification or placement', () => {
    // Publishing is offered; the badge is not. `verification_status` moves only
    // through `admin_decide_vendor()`, which records who decided it.
    const parsed = adminCreateVendorSchema.parse({
      ...BASE,
      verification_status: 'verified',
      is_featured: true,
    })
    expect(parsed).not.toHaveProperty('verification_status')
    expect(parsed).not.toHaveProperty('is_featured')
  })
})

describe('describeCreateVendorError', () => {
  it('forwards our own refusals, which are written to be read', () => {
    const taken = describeCreateVendorError(
      { code: 'PT409', message: 'The web address "marigold" is already used by another business.' },
      'fallback',
    )
    expect(taken.code).toBe('conflict')
    expect(taken.message).toContain('marigold')
    // Points at the one field the admin can change.
    expect(taken.field).toBe('slug')

    const unknownOwner = describeCreateVendorError(
      { code: 'P0002', message: 'No account exists for a@b.com. Ask them to sign up first…' },
      'fallback',
    )
    expect(unknownOwner.field).toBe('ownerEmail')
    expect(unknownOwner.message).toContain('a@b.com')
  })

  it('replaces messages Postgres wrote about its own schema', () => {
    /*
     * 23505 is raised by the index, not by us, and its text names the
     * constraint. Only the classification survives — this is the same shape as
     * the raw RLS message that once reached a customer's screen.
     */
    const race = describeCreateVendorError(
      {
        code: '23505',
        message: 'duplicate key value violates unique constraint "vendors_slug_key"',
      },
      'fallback',
    )
    expect(race.code).toBe('conflict')
    expect(race.message).not.toContain('vendors_slug_key')
    expect(race.field).toBe('slug')
  })

  it('names a missing migration rather than saying "something went wrong"', () => {
    // Deploys and migrations are separate manual steps here, so an admin will
    // genuinely meet this. It is the one failure that is a one-line fix.
    const missing = describeCreateVendorError(
      { code: 'PGRST202', message: 'Could not find the function public.admin_create_vendor…' },
      'fallback',
    )
    expect(missing.code).toBe('not_implemented')
    expect(missing.message).toContain('0039')
    expect(missing.message).not.toContain('public.admin_create_vendor')
  })

  it('does not leak a permission failure as a validation message', () => {
    const denied = describeCreateVendorError({ code: '42501', message: 'permission denied' }, 'f')
    expect(denied.code).toBe('forbidden')
    expect(denied.field).toBeUndefined()
  })

  it('falls back for anything it does not recognise', () => {
    const unknown = describeCreateVendorError(
      { code: 'XX000', message: 'internal database detail' },
      'We could not create that business.',
    )
    expect(unknown.code).toBe('internal_error')
    expect(unknown.message).toBe('We could not create that business.')
  })

  it('does not forward an empty message as if it were ours', () => {
    // A PT409 with no text would otherwise produce a blank error box.
    const empty = describeCreateVendorError({ code: 'PT409', message: '' }, 'fallback')
    expect(empty.code).toBe('internal_error')
    expect(empty.message).toBe('fallback')
  })
})
