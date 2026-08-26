import { describe, expect, it } from 'vitest'

import { slugify } from '@/features/vendors/schema'

/**
 * Slug generation for auto-created vendors.
 *
 * Written after vendor sign-up broke in production. `uniqueSlug` checked for
 * collisions through the request-scoped Supabase client, which is subject to
 * RLS — so a draft vendor owned by someone else was invisible and the slug
 * looked free. The insert then hit the real unique index with 23505, the error
 * was swallowed, and the user was bounced back to /vendor/join with no
 * explanation. Two users named "alok" were enough to trigger it.
 *
 * The lesson generalises past this bug and is already a standing rule in this
 * repo: **a read through RLS can never prove absence.** These cases pin the
 * candidate sequence that the retry loop walks, so the fallback path stays
 * predictable.
 */
describe('slug candidates for a new vendor', () => {
  // Mirrors the loop in `createVendorForUser`.
  const candidates = (name: string, count: number) => {
    const root = slugify(name) || 'business'
    return Array.from({ length: count }, (_, i) => (i === 0 ? root : `${root}-${i + 1}`))
  }

  it('starts from the business name and then suffixes', () => {
    expect(candidates('alok', 3)).toEqual(['alok', 'alok-2', 'alok-3'])
  })

  it('handles the display names real vendors actually use', () => {
    expect(slugify('Marigold Courtyard')).toBe('marigold-courtyard')
    expect(slugify('Saffron & Salt Photography')).toBe('saffron-salt-photography')
    expect(slugify('  Dhol & Co.  ')).toBe('dhol-co')
  })

  it('falls back to a usable root when the name slugifies to nothing', () => {
    // A profile name of punctuation or non-Latin script must not produce an
    // empty slug — that would be a unique-constraint magnet across users.
    for (const name of ['!!!', '   ', '---']) {
      expect(candidates(name, 1)[0]).toBe('business')
    }
  })

  it('never produces an empty candidate', () => {
    for (const name of ['a', 'A B', '!!!', '', '   ']) {
      for (const c of candidates(name, 3)) {
        expect(c.length).toBeGreaterThan(0)
        expect(c).not.toMatch(/^-|-$/)
      }
    }
  })
})
