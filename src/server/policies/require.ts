import 'server-only'

import { redirect } from 'next/navigation'

import { serverEnv } from '@/lib/env'
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

  /*
   * Enforcement is opt-in via `ADMIN_MFA_REQUIRED`, and off by default.
   *
   * PRD 10.3 asks for admin MFA, and this deployment has chosen not to require
   * it for now — a deliberate decision, recorded in STATUS.md rather than
   * quietly reversed. The enrolment page stays available at `/admin/security`,
   * so an administrator can still turn on a second factor for their own
   * account; it just no longer gates the rest of the panel.
   *
   * Turning it back on is one environment variable. Nothing else changes:
   * the challenge, the 30-minute session, and the enrol-first redirect are all
   * still here and still tested.
   */
  if (!serverEnv().ADMIN_MFA_REQUIRED) return actor

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
