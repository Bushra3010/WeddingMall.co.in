/**
 * Permission catalogue (PRD 4.4).
 *
 * Single source of truth for authorisation vocabulary. Conditionals scattered
 * across components are explicitly forbidden — components ask `can()`, and the
 * server re-checks independently of what the UI decided.
 *
 * This file is mirrored by migration 0002 (`admin_permissions` seed rows). If
 * you add a permission here, add the matching row there.
 */

export const PERMISSIONS = [
  'vendor.read',
  'vendor.verify',
  'vendor.suspend',
  'listing.moderate',
  'lead.read',
  'lead.assign',
  'lead.export',
  'review.moderate',
  'cms.publish',
  'billing.manage',
  'user.support',
  'analytics.read',
  'admin.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const ADMIN_ROLES = [
  'super_admin',
  'operations_admin',
  'vendor_verifier',
  'content_admin',
  'support_agent',
  'finance_admin',
  'analyst',
] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  operations_admin: [
    'vendor.read',
    'vendor.verify',
    'vendor.suspend',
    'listing.moderate',
    'lead.read',
    'lead.assign',
    'review.moderate',
    'analytics.read',
  ],
  vendor_verifier: ['vendor.read', 'vendor.verify', 'listing.moderate'],
  content_admin: ['cms.publish', 'vendor.read', 'analytics.read'],
  support_agent: ['vendor.read', 'lead.read', 'user.support'],
  finance_admin: ['vendor.read', 'billing.manage', 'analytics.read'],
  analyst: ['analytics.read', 'vendor.read'],
}

/** Vendor membership roles (PRD 4.4). */
export const VENDOR_ROLES = [
  'vendor_owner',
  'vendor_manager',
  'vendor_sales',
  'vendor_editor',
  'vendor_viewer',
] as const

export type VendorRole = (typeof VENDOR_ROLES)[number]

export const VENDOR_CAPABILITIES = [
  'listing.edit',
  'listing.submit',
  'package.manage',
  'media.manage',
  'availability.manage',
  'lead.view',
  'lead.view_pii',
  'lead.respond',
  'lead.assign',
  'lead.export',
  'note.manage',
  'team.manage',
  'team.transfer_owner',
  'billing.manage',
  'analytics.view',
  'vendor.delete_request',
] as const

export type VendorCapability = (typeof VENDOR_CAPABILITIES)[number]

/**
 * `lead.view_pii` for `vendor_editor` is deliberately absent: an editor sees
 * lead content but not customer contact details until the lead is assigned to
 * them (PRD 4.4). Assignment is checked separately in the lead policy.
 */
export const VENDOR_ROLE_CAPABILITIES: Record<VendorRole, readonly VendorCapability[]> = {
  vendor_owner: VENDOR_CAPABILITIES,
  vendor_manager: [
    'listing.edit',
    'listing.submit',
    'package.manage',
    'media.manage',
    'availability.manage',
    'lead.view',
    'lead.view_pii',
    'lead.respond',
    'lead.assign',
    'lead.export',
    'note.manage',
    'team.manage',
    'analytics.view',
  ],
  vendor_sales: ['lead.view', 'lead.view_pii', 'lead.respond', 'note.manage', 'analytics.view'],
  vendor_editor: [
    'listing.edit',
    'package.manage',
    'media.manage',
    'availability.manage',
    'lead.view',
    'analytics.view',
  ],
  vendor_viewer: ['analytics.view'],
}

/** Ordering used to stop a member granting a role above their own. */
const VENDOR_ROLE_RANK: Record<VendorRole, number> = {
  vendor_owner: 5,
  vendor_manager: 4,
  vendor_sales: 3,
  vendor_editor: 2,
  vendor_viewer: 1,
}

export function canGrantVendorRole(actor: VendorRole, target: VendorRole): boolean {
  if (actor === 'vendor_owner') return true
  return VENDOR_ROLE_RANK[actor] > VENDOR_ROLE_RANK[target]
}
