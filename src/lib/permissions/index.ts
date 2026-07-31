import {
  ADMIN_ROLE_PERMISSIONS,
  VENDOR_ROLE_CAPABILITIES,
  type AdminRole,
  type Permission,
  type VendorCapability,
  type VendorRole,
} from './catalogue'

export * from './catalogue'

/** The authorisation facts resolved once per request. */
export interface Actor {
  userId: string | null
  adminRoles: readonly AdminRole[]
  /** vendorId -> membership role, for accepted memberships only. */
  vendorRoles: Readonly<Record<string, VendorRole>>
}

export const GUEST: Actor = { userId: null, adminRoles: [], vendorRoles: {} }

export function permissionsFor(roles: readonly AdminRole[]): Set<Permission> {
  const set = new Set<Permission>()
  for (const role of roles) {
    for (const permission of ADMIN_ROLE_PERMISSIONS[role] ?? []) set.add(permission)
  }
  return set
}

export function can(actor: Actor, permission: Permission): boolean {
  if (!actor.userId) return false
  return permissionsFor(actor.adminRoles).has(permission)
}

export function isAdmin(actor: Actor): boolean {
  return actor.adminRoles.length > 0
}

export function vendorRole(actor: Actor, vendorId: string): VendorRole | null {
  return actor.vendorRoles[vendorId] ?? null
}

export function canVendor(actor: Actor, vendorId: string, capability: VendorCapability): boolean {
  const role = vendorRole(actor, vendorId)
  if (!role) return false
  return VENDOR_ROLE_CAPABILITIES[role].includes(capability)
}

/** Thrown by server services; mapped to a `forbidden` ActionResult. */
export class PermissionError extends Error {
  readonly code = 'forbidden'
  constructor(message = 'You do not have permission to perform this action.') {
    super(message)
    this.name = 'PermissionError'
  }
}

export function assertPermission(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) throw new PermissionError()
}

export function assertVendorCapability(
  actor: Actor,
  vendorId: string,
  capability: VendorCapability,
): void {
  if (!canVendor(actor, vendorId, capability)) throw new PermissionError()
}
