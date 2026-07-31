import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ServiceError } from '@/lib/action-result'
import {
  assertVendorCapability,
  canGrantVendorRole,
  vendorRole,
  type Actor,
  type VendorRole,
} from '@/lib/permissions'

/**
 * Vendor team management (PRD 6.9).
 *
 * The role ceiling is checked here *and* in `invite_vendor_member()`. Both are
 * needed: this one produces a good error message, the SQL one is the boundary
 * that holds if a caller reaches PostgREST directly.
 */

function translate(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code === 'P0001') throw new ServiceError('invalid_state', error.message ?? fallback)
  if (error?.code === '42501') {
    throw new ServiceError('forbidden', error.message ?? 'You do not have permission to do that.')
  }
  if (error?.code === '23505') {
    throw new ServiceError('conflict', 'That person is already on the team.')
  }
  throw new ServiceError('internal_error', fallback)
}

export async function inviteMember(
  actor: Actor,
  vendorId: string,
  email: string,
  role: VendorRole,
) {
  assertVendorCapability(actor, vendorId, 'team.manage')

  const actorRole = vendorRole(actor, vendorId)
  if (!actorRole || !canGrantVendorRole(actorRole, role)) {
    throw new ServiceError('forbidden', 'You cannot grant a role at or above your own level.')
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('invite_vendor_member', {
    target_vendor: vendorId,
    invitee_email: email,
    member_role: role,
  })

  if (error) translate(error, 'We could not send that invitation.')
  return { ok: true }
}

export async function changeMemberRole(
  actor: Actor,
  vendorId: string,
  membershipId: string,
  role: VendorRole,
) {
  assertVendorCapability(actor, vendorId, 'team.manage')

  const actorRole = vendorRole(actor, vendorId)
  if (!actorRole || !canGrantVendorRole(actorRole, role)) {
    throw new ServiceError('forbidden', 'You cannot grant a role at or above your own level.')
  }

  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('vendor_memberships')
    .select('user_id, role, vendors(owner_user_id)')
    .eq('id', membershipId)
    .eq('vendor_id', vendorId)
    .maybeSingle()

  if (!membership) throw new ServiceError('not_found', 'That team member was not found.')

  // The owner cannot be demoted without an explicit ownership transfer
  // (PRD 6.9: "owner cannot remove themselves without ownership transfer").
  if (membership.vendors?.owner_user_id === membership.user_id && role !== 'vendor_owner') {
    throw new ServiceError(
      'invalid_state',
      'Transfer ownership to someone else before changing the owner’s role.',
    )
  }

  const { error } = await supabase
    .from('vendor_memberships')
    .update({ role })
    .eq('id', membershipId)
    .eq('vendor_id', vendorId)

  if (error) translate(error, 'We could not update that role.')
  return { ok: true }
}

export async function revokeMember(actor: Actor, vendorId: string, membershipId: string) {
  assertVendorCapability(actor, vendorId, 'team.manage')

  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('vendor_memberships')
    .select('user_id, vendors(owner_user_id)')
    .eq('id', membershipId)
    .eq('vendor_id', vendorId)
    .maybeSingle()

  if (!membership) throw new ServiceError('not_found', 'That team member was not found.')

  if (membership.vendors?.owner_user_id === membership.user_id) {
    throw new ServiceError(
      'invalid_state',
      'The owner cannot be removed. Transfer ownership first.',
    )
  }

  // Revoked rather than deleted, so the membership history survives.
  const { error } = await supabase
    .from('vendor_memberships')
    .update({ status: 'revoked' })
    .eq('id', membershipId)
    .eq('vendor_id', vendorId)

  if (error) translate(error, 'We could not remove that team member.')
  return { ok: true }
}

export async function acceptInvitation(actor: Actor, membershipId: string) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in first.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('vendor_memberships')
    .update({ status: 'active' })
    .eq('id', membershipId)
    .eq('user_id', actor.userId)
    .eq('status', 'invited')

  if (error) translate(error, 'We could not accept that invitation.')
  return { ok: true }
}
