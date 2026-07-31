import { describe, expect, it } from 'vitest'

import {
  can,
  canGrantVendorRole,
  canVendor,
  GUEST,
  isAdmin,
  permissionsFor,
  type Actor,
} from '@/lib/permissions'

const vendorId = '11111111-1111-1111-1111-111111111111'

function actor(overrides: Partial<Actor> = {}): Actor {
  return { userId: 'user-1', adminRoles: [], vendorRoles: {}, ...overrides }
}

describe('admin permissions', () => {
  it('denies everything to a guest', () => {
    expect(can(GUEST, 'vendor.read')).toBe(false)
    expect(can(GUEST, 'admin.manage')).toBe(false)
    expect(isAdmin(GUEST)).toBe(false)
  })

  it('denies everything to a signed-in user with no admin role', () => {
    expect(can(actor(), 'lead.read')).toBe(false)
    expect(isAdmin(actor())).toBe(false)
  })

  it('gives super_admin every permission', () => {
    const superAdmin = actor({ adminRoles: ['super_admin'] })
    expect(can(superAdmin, 'admin.manage')).toBe(true)
    expect(can(superAdmin, 'billing.manage')).toBe(true)
    expect(can(superAdmin, 'lead.export')).toBe(true)
  })

  it('scopes a vendor_verifier to verification work only', () => {
    const verifier = actor({ adminRoles: ['vendor_verifier'] })
    expect(can(verifier, 'vendor.verify')).toBe(true)
    expect(can(verifier, 'listing.moderate')).toBe(true)
    expect(can(verifier, 'billing.manage')).toBe(false)
    expect(can(verifier, 'lead.export')).toBe(false)
  })

  it('unions permissions across multiple roles', () => {
    const both = permissionsFor(['analyst', 'finance_admin'])
    expect(both.has('analytics.read')).toBe(true)
    expect(both.has('billing.manage')).toBe(true)
    expect(both.has('admin.manage')).toBe(false)
  })
})

describe('vendor capabilities', () => {
  it('denies a non-member', () => {
    expect(canVendor(actor(), vendorId, 'listing.edit')).toBe(false)
  })

  it('gives the owner every capability', () => {
    const owner = actor({ vendorRoles: { [vendorId]: 'vendor_owner' } })
    expect(canVendor(owner, vendorId, 'billing.manage')).toBe(true)
    expect(canVendor(owner, vendorId, 'team.transfer_owner')).toBe(true)
  })

  it('withholds billing and owner transfer from a manager', () => {
    const manager = actor({ vendorRoles: { [vendorId]: 'vendor_manager' } })
    expect(canVendor(manager, vendorId, 'team.manage')).toBe(true)
    expect(canVendor(manager, vendorId, 'billing.manage')).toBe(false)
    expect(canVendor(manager, vendorId, 'team.transfer_owner')).toBe(false)
  })

  it('withholds lead PII from an editor (PRD 4.4)', () => {
    const editor = actor({ vendorRoles: { [vendorId]: 'vendor_editor' } })
    expect(canVendor(editor, vendorId, 'lead.view')).toBe(true)
    expect(canVendor(editor, vendorId, 'lead.view_pii')).toBe(false)
  })

  it('limits a viewer to analytics', () => {
    const viewer = actor({ vendorRoles: { [vendorId]: 'vendor_viewer' } })
    expect(canVendor(viewer, vendorId, 'analytics.view')).toBe(true)
    expect(canVendor(viewer, vendorId, 'listing.edit')).toBe(false)
    expect(canVendor(viewer, vendorId, 'lead.view')).toBe(false)
  })

  it('does not leak a capability across vendors', () => {
    const owner = actor({ vendorRoles: { [vendorId]: 'vendor_owner' } })
    expect(canVendor(owner, '22222222-2222-2222-2222-222222222222', 'listing.edit')).toBe(false)
  })
})

describe('role ceiling', () => {
  it('lets an owner grant any role', () => {
    expect(canGrantVendorRole('vendor_owner', 'vendor_owner')).toBe(true)
    expect(canGrantVendorRole('vendor_owner', 'vendor_manager')).toBe(true)
  })

  it('stops a manager granting owner or another manager', () => {
    expect(canGrantVendorRole('vendor_manager', 'vendor_owner')).toBe(false)
    expect(canGrantVendorRole('vendor_manager', 'vendor_manager')).toBe(false)
    expect(canGrantVendorRole('vendor_manager', 'vendor_sales')).toBe(true)
  })

  it('stops a viewer granting anything', () => {
    expect(canGrantVendorRole('vendor_viewer', 'vendor_viewer')).toBe(false)
  })
})
