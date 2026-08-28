import { describe, expect, it } from 'vitest'

import { adminVendorSchema } from '@/features/vendors/schema'

/**
 * The boundary an admin's edits cross.
 *
 * Two things are worth pinning here. The description rule has to match the
 * floor `submit_vendor_for_review()` applies in SQL, or an admin becomes a way
 * around a gate every vendor has to clear. And the schema has to keep refusing
 * the fields it does not list — `status`, `verification_status`, `plan_id`,
 * `is_featured` — because those move only through `admin_decide_vendor()`,
 * which writes an audit entry.
 */

const BASE = {
  vendorId: '3f1c8a2e-7b4d-4c6a-9e1f-2a5b8c0d4e7f',
  displayName: 'Pearl Banquet Hall',
  legalName: '',
  slug: 'pearl-banquet-hall',
  primaryCityId: '9a2b1c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
  email: '',
  phone: '',
  website: '',
  about: '',
}

describe('adminVendorSchema', () => {
  it('accepts a business whose description has not been written yet', () => {
    // A registration reaches the review queue before anything is filled in
    // (migration 0035), and an admin must be able to correct its name or city
    // without being forced to invent a description for it.
    expect(adminVendorSchema.safeParse(BASE).success).toBe(true)
  })

  it('refuses a stub description, at the same length the SQL gate uses', () => {
    const result = adminVendorSchema.safeParse({ ...BASE, about: 'Nice venue.' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['about'])
  })

  it('accepts a description at exactly the SQL floor', () => {
    expect(adminVendorSchema.safeParse({ ...BASE, about: 'x'.repeat(50) }).success).toBe(true)
  })

  it('refuses a slug that would not survive as a URL', () => {
    for (const slug of ['Pearl Hall', 'pearl_hall', 'pearl--hall', '-pearl', 'ab']) {
      expect(adminVendorSchema.safeParse({ ...BASE, slug }).success, slug).toBe(false)
    }
  })

  it('refuses a founding year in the future', () => {
    const next = String(new Date().getFullYear() + 1)
    expect(adminVendorSchema.safeParse({ ...BASE, foundedYear: next }).success).toBe(false)
  })

  it('leaves optional contact fields empty rather than inventing them', () => {
    const parsed = adminVendorSchema.parse(BASE)
    expect(parsed.email).toBe('')
    expect(parsed.phone).toBe('')
    expect(parsed.website).toBe('')
  })

  it('drops anything that decides publication, verification, or placement', () => {
    const parsed = adminVendorSchema.parse({
      ...BASE,
      status: 'active',
      verification_status: 'verified',
      is_featured: true,
      plan_id: '00000000-0000-4000-8000-000000000000',
    })

    expect(parsed).not.toHaveProperty('status')
    expect(parsed).not.toHaveProperty('verification_status')
    expect(parsed).not.toHaveProperty('is_featured')
    expect(parsed).not.toHaveProperty('plan_id')
  })
})
