import 'server-only'

import { ServiceError } from '@/lib/action-result'
import { assertPermission, type Actor } from '@/lib/permissions'
import { audit } from '@/lib/security/audit'
import {
  deleteAuthUser,
  getAccountBlockers,
  hasAdminAccess,
} from '@/server/jobs/delete-customer'

/**
 * Deleting a customer account (PRD 6.11, 14.3).
 *
 * ## Where the boundary is
 *
 * Not RLS, unavoidably: the account is a row in `auth.users`, which PostgREST
 * does not expose and no policy covers. This function *is* the boundary, which
 * is why the checks below are ordered so the cheap refusals happen before
 * anything touches the service role.
 *
 * ## Why this is a hard delete and not a request
 *
 * `features/privacy/actions.ts` deliberately records a customer's own deletion
 * ask as a *request* rather than acting on it, because it may remove enquiry
 * history a vendor needs for a live booking. That reasoning still stands and is
 * not contradicted here — it is enforced. The four `on delete restrict` keys to
 * `profiles` are precisely enquiries, reviews, messages and owned businesses,
 * so an account with any history cannot be deleted by this path at all. What is
 * left is what an admin actually needs to remove: accounts that never did
 * anything, of which this database currently has a great many.
 */
export async function deleteCustomerAsAdmin(actor: Actor, userId: string) {
  // Deliberately stricter than the page it is reached from. Browsing accounts
  // is `user.support`; removing one is not something a support agent should be
  // able to do by misclicking.
  assertPermission(actor, 'admin.manage')

  if (!userId) throw new ServiceError('validation_error', 'Missing account.')

  /*
   * Locking yourself out is a support ticket at best and an outage at worst —
   * the same reasoning `revokeAdminRoleAction` applies to admin roles, and here
   * it is worse, because the account cannot be restored.
   */
  if (userId === actor.userId) {
    throw new ServiceError('conflict', 'You cannot delete your own account.')
  }

  if (await hasAdminAccess(userId)) {
    throw new ServiceError(
      'conflict',
      'That account has administrator access. Revoke it under Admin users first, so removing a colleague is a deliberate two-step.',
    )
  }

  const blockers = await getAccountBlockers(userId)
  if (blockers.length > 0) {
    throw new ServiceError(
      'conflict',
      `This account has ${blockers.join(', ')} attached, which other people's records depend on. It cannot be deleted.`,
    )
  }

  /*
   * Audited *before* the delete, not after.
   *
   * `audit_logs.actor_user_id` and the entry itself survive the account, but
   * the write has to happen while there is still something to describe — and if
   * the delete succeeds and the audit write is the thing that fails, an
   * untraceable deletion is the worst of the two outcomes. A logged attempt
   * that did not happen is recoverable; an unlogged deletion is not.
   */
  await audit({
    action: 'user.delete',
    entityType: 'profile',
    entityId: userId,
    actorUserId: actor.userId,
    after: { deleted: true },
  })

  const { error } = await deleteAuthUser(userId)
  if (error) {
    // A race: something attached itself between the count and the delete. The
    // database refused, so nothing was removed.
    throw new ServiceError(
      'conflict',
      'That account could not be deleted — something was attached to it while we were checking. Reload and try again.',
    )
  }

  return { id: userId }
}
