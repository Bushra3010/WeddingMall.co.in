import 'server-only'

import { redirect } from 'next/navigation'

import { getMfaState } from '@/lib/security/mfa'
import { getActor } from '@/server/dal/actor'
import {
  assertPermission,
  assertVendorCapability,
  isAdmin,
  type Actor,
  type Permission,
  type VendorCapability,
} from '@/lib/permissions'

/**
 * Route-level guards.
 *
 * These produce a good redirect for humans; they are NOT the security boundary.
 * Every query underneath still runs under RLS, and every mutation re-checks
 * with `assert*` (PRD 3, 10.1, Epic A).
 */

export async function requireUser(returnTo?: string): Promise<Actor & { userId: string }> {
  const actor = await getActor()
  if (!actor.userId) {
    const target = returnTo ? `?next=${encodeURIComponent(returnTo)}` : ''
    redirect(`/auth/sign-in${target}`)
  }
  return actor as Actor & { userId: string }
}

export async function requireAdmin(permission?: Permission) {
  const actor = await requireUser('/admin')
  if (!isAdmin(actor)) redirect('/')
  if (permission) assertPermission(actor, permission)
  return actor
}

/**
 * `requireAdmin` plus a live second factor (PRD 10.3).
 *
 * Used by every admin route except `/admin/security`, which has to stay
 * reachable at aal1 or the only page that can fix a missing or stale factor
 * becomes unreachable.
 *
 * These are redirects, not errors: an administrator who needs to enrol should
 * land on the enrolment form, not on a permission failure that tells them
 * nothing about what to do next.
 */
export async function requireElevatedAdmin(permission?: Permission) {
  const actor = await requireAdmin(permission)

  const state = await getMfaState()
  if (state.status === 'enrol') redirect('/admin/security?reason=enrol')
  if (state.status === 'challenge') redirect('/admin/security?reason=challenge')
  if (state.status === 'stale') redirect('/admin/security?reason=stale')

  return actor
}

export async function requireVendorMember(vendorId: string, capability: VendorCapability) {
  const actor = await requireUser('/vendor-dashboard')
  assertVendorCapability(actor, vendorId, capability)
  return actor
}

/** The vendor a member lands on. Onboarding when they have none yet. */
export async function requireOwnVendorId(): Promise<string> {
  const actor = await requireUser('/vendor-dashboard')
  const [vendorId] = Object.keys(actor.vendorRoles)
  if (!vendorId) redirect('/vendor-dashboard/onboarding')
  return vendorId
}
