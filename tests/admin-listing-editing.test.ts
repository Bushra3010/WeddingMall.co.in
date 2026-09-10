import { describe, expect, it } from 'vitest'

import {
  ADMIN_ROLE_PERMISSIONS,
  assertListingCapability,
  can,
  isListingModerator,
  type Actor,
} from '@/lib/permissions'

/**
 * An admin editing a business's listing (migration 0041).
 *
 * `/admin/vendors/new` could create a business and then there was nowhere to add
 * a photograph — nor a service area, a package or an availability block. The
 * fix is one permission, `listing.moderate`, admitted by the same guard the
 * vendor's own capabilities go through, so the vendor wizard renders unchanged
 * for an admin.
 *
 * The tests worth having are the boundaries, because the guard is the only
 * thing standing between "an admin finishes a listing" and "a support agent
 * edits any business on the marketplace". RLS says the same thing in 0041; if
 * these two ever disagree the refusal arrives as a 42501 with no sentence
 * attached.
 */

const VENDOR = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

function actor(overrides: Partial<Actor> = {}): Actor {
  return { userId: 'u1', adminRoles: [], vendorRoles: {}, ...overrides }
}

const owner = actor({ vendorRoles: { [VENDOR]: 'vendor_owner' } })
const editor = actor({ vendorRoles: { [VENDOR]: 'vendor_editor' } })
const viewer = actor({ vendorRoles: { [VENDOR]: 'vendor_viewer' } })
const verifier = actor({ adminRoles: ['vendor_verifier'] })
const operations = actor({ adminRoles: ['operations_admin'] })
const support = actor({ adminRoles: ['support_agent'] })
const analyst = actor({ adminRoles: ['analyst'] })
const contentAdmin = actor({ adminRoles: ['content_admin'] })
const financeAdmin = actor({ adminRoles: ['finance_admin'] })

const allowed = (a: Actor, vendorId = VENDOR, capability = 'media.manage' as const) => {
  try {
    assertListingCapability(a, vendorId, capability)
    return true
  } catch {
    return false
  }
}

describe('who may edit a listing', () => {
  it('admits the vendor own team, exactly as before', () => {
    expect(allowed(owner)).toBe(true)
    expect(allowed(editor)).toBe(true)
    // vendor_viewer holds analytics.view and nothing else.
    expect(allowed(viewer)).toBe(false)
  })

  it('admits the admins who moderate listings, on any business', () => {
    expect(allowed(verifier)).toBe(true)
    expect(allowed(operations)).toBe(true)
    expect(allowed(verifier, OTHER)).toBe(true)
  })

  /*
   * The boundary that matters. All four hold `vendor.read` — they can see the
   * business in the admin panel — and none of them may change what it shows.
   */
  it('refuses every admin without listing.moderate', () => {
    for (const a of [support, analyst, contentAdmin, financeAdmin]) {
      expect(allowed(a)).toBe(false)
    }
  })

  it('refuses a signed-out actor and a signed-in stranger', () => {
    expect(allowed(actor({ userId: null }))).toBe(false)
    expect(allowed(actor())).toBe(false)
  })
})

/*
 * `saveVendorProfile` writes the `vendors` row as well as the listing, and that
 * row is governed by `vendors: admin moderate` (0008), which asks for
 * vendor.verify or vendor.suspend rather than listing.moderate. Nothing breaks
 * today because the three roles holding listing.moderate all hold vendor.verify
 * too — an assumption that is invisible in either file, so it is asserted here.
 * A role given listing.moderate alone would save the listing half of the
 * Business step and be refused the other half.
 */
describe('listing.moderate implies vendor.verify', () => {
  it('holds for every role in the catalogue', () => {
    for (const [role, permissions] of Object.entries(ADMIN_ROLE_PERMISSIONS)) {
      if (!permissions.includes('listing.moderate')) continue
      expect(
        can(actor({ adminRoles: [role as keyof typeof ADMIN_ROLE_PERMISSIONS] }), 'vendor.verify'),
        `${role} holds listing.moderate and must also hold vendor.verify`,
      ).toBe(true)
    }
  })
})

/*
 * Media a moderator uploads enters `approved`, because the person who would
 * approve it chose the file. The distinction has to be "not this business's own
 * team", not "is an admin": an admin who is also a member of the business they
 * are editing is acting as the business, and their photograph goes through
 * moderation like anyone else's.
 */
describe('who counts as a moderator for an upload', () => {
  it('is true for an admin editing somebody else business', () => {
    expect(isListingModerator(verifier, VENDOR)).toBe(true)
    expect(isListingModerator(operations, OTHER)).toBe(true)
  })

  it('is false for the business own team', () => {
    expect(isListingModerator(owner, VENDOR)).toBe(false)
    expect(isListingModerator(editor, VENDOR)).toBe(false)
  })

  it('is false for an admin who is also a member of that business', () => {
    const both = actor({
      adminRoles: ['vendor_verifier'],
      vendorRoles: { [VENDOR]: 'vendor_owner' },
    })
    expect(isListingModerator(both, VENDOR)).toBe(false)
    // …and true again for a business they do not belong to.
    expect(isListingModerator(both, OTHER)).toBe(true)
  })

  it('is false for an admin who cannot moderate listings at all', () => {
    expect(isListingModerator(support, VENDOR)).toBe(false)
    expect(isListingModerator(financeAdmin, VENDOR)).toBe(false)
  })
})
