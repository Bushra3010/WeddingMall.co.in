'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { audit } from '@/lib/security/audit'
import { getActor } from '@/server/dal/actor'

/** Platform settings and admin membership (PRD 6.11, 10.3). */

const policySchema = z.object({
  firstResponseHours: z.coerce.number().int().min(1).max(720),
  reviewEditWindowHours: z.coerce.number().int().min(0).max(8760),
})

export async function savePlatformPolicyAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const result = await runAction('admin.savePolicy', async () => {
    const actor = await getActor()
    if (!can(actor, 'admin.manage')) {
      throw new ServiceError('forbidden', 'You do not have permission to change settings.')
    }

    const input = policySchema.parse({
      firstResponseHours: String(form.get('firstResponseHours') ?? ''),
      reviewEditWindowHours: String(form.get('reviewEditWindowHours') ?? ''),
    })

    const supabase = await createClient()

    // Both are singletons guarded by `id = true`, so these update the one row
    // rather than needing to know its identifier.
    const [sla, review] = await Promise.all([
      supabase
        .from('sla_policy')
        .update({ first_response_hours: input.firstResponseHours })
        .eq('id', true),
      supabase
        .from('review_policy')
        .update({ edit_window_hours: input.reviewEditWindowHours })
        .eq('id', true),
    ])

    if (sla.error || review.error) {
      throw new ServiceError('internal_error', 'We could not save those settings.')
    }

    void audit({
      action: 'billing.override',
      entityType: 'platform_policy',
      actorUserId: actor.userId,
      after: input,
    })

    return { ok: true as const }
  })

  if (result.ok) revalidatePath('/admin/settings')
  return result
}

/**
 * Grants an admin role.
 *
 * `super_admin` is deliberately not grantable here. Epic E requires that the
 * super-admin role cannot be created through public input, and a Server Action
 * is a public endpoint — so the only path to it stays the out-of-band script,
 * which runs with the service key and writes an audit entry. An admin who can
 * mint super-admins through the UI is one compromised session away from being
 * unrecoverable.
 */
const grantSchema = z.object({
  userId: z.uuid('Choose an account.'),
  roleCode: z.enum([
    'operations_admin',
    'vendor_verifier',
    'content_admin',
    'support_agent',
    'finance_admin',
    'analyst',
  ]),
})

export async function grantAdminRoleAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ userId: string }>> {
  const result = await runAction('admin.grantRole', async () => {
    const actor = await getActor()
    if (!can(actor, 'admin.manage')) {
      throw new ServiceError('forbidden', 'You do not have permission to manage administrators.')
    }

    const input = grantSchema.parse({
      userId: String(form.get('userId') ?? ''),
      roleCode: String(form.get('roleCode') ?? ''),
    })

    const supabase = await createClient()
    const { data: role } = await supabase
      .from('admin_roles')
      .select('id')
      .eq('code', input.roleCode)
      .maybeSingle()

    if (!role) throw new ServiceError('not_found', 'That role does not exist.')

    const { error } = await supabase
      .from('admin_memberships')
      .upsert(
        { user_id: input.userId, role_id: role.id, status: 'active', invited_by: actor.userId },
        { onConflict: 'user_id,role_id' },
      )

    if (error) throw new ServiceError('internal_error', 'We could not grant that role.')

    void audit({
      action: 'role.change',
      entityType: 'admin_membership',
      entityId: input.userId,
      actorUserId: actor.userId,
      after: { role: input.roleCode, status: 'active' },
    })

    return { userId: input.userId }
  })

  if (result.ok) revalidatePath('/admin/admin-users')
  return result
}

export async function revokeAdminRoleAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction('admin.revokeRole', async () => {
    const actor = await getActor()
    if (!can(actor, 'admin.manage')) {
      throw new ServiceError('forbidden', 'You do not have permission to manage administrators.')
    }

    const id = String(form.get('id') ?? '')
    if (!id) throw new ServiceError('validation_error', 'Missing membership.')

    const supabase = await createClient()
    const { data: membership } = await supabase
      .from('admin_memberships')
      .select('user_id, admin_roles(code)')
      .eq('id', id)
      .maybeSingle()

    if (!membership) throw new ServiceError('not_found', 'That membership no longer exists.')

    // Locking yourself out is a support ticket at best and an outage at worst.
    if (membership.user_id === actor.userId) {
      throw new ServiceError('conflict', 'You cannot revoke your own administrator access.')
    }

    const { error } = await supabase
      .from('admin_memberships')
      .update({ status: 'revoked' })
      .eq('id', id)

    if (error) throw new ServiceError('internal_error', 'We could not revoke that role.')

    void audit({
      action: 'role.change',
      entityType: 'admin_membership',
      entityId: membership.user_id,
      actorUserId: actor.userId,
      after: { role: membership.admin_roles?.code ?? 'unknown', status: 'revoked' },
    })

    return { id }
  })

  if (result.ok) revalidatePath('/admin/admin-users')
  return result
}
