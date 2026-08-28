import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/observability/logger'

/**
 * Removing a customer account.
 *
 * ## Why this is a job and not a `delete_*()` function like the others
 *
 * Every other admin delete in this codebase is SQL behind a policy, because the
 * row lives in a PostgREST-exposed table and RLS is the boundary. A customer
 * account does not: the row that *is* the account is `auth.users`, which
 * PostgREST never exposes and RLS never covers. Deleting `public.profiles`
 * instead would leave the auth record behind — the person could still sign in,
 * to an account with no profile, and `handle_new_user` only fires on insert so
 * nothing would rebuild it.
 *
 * So the delete has to go through the Auth admin API, which means the service
 * role, which means this file (CLAUDE.md: the admin client is permitted in
 * `src/server/jobs`). Authorisation therefore cannot be RLS and lives in
 * `deleteCustomerAsAdmin` instead. That is inherent to `auth.users`, not a
 * shortcut around the invariant.
 *
 * `auth.users` → `profiles` cascades, and from `profiles` so do the shortlist,
 * notifications, wedding profile, data requests, and memberships.
 */

/** "3 enquiries", "1 review" — the phrase an admin reads. */
function phrase(count: number, one: string, many: string): string | null {
  return count > 0 ? `${count} ${count === 1 ? one : many}` : null
}

/**
 * What still points at this account, phrased for an admin.
 *
 * These four are exactly the `on delete restrict` foreign keys to `profiles`.
 * The database would refuse the delete anyway — the point of counting first is
 * that Postgres's refusal names a constraint, and this one names a person's
 * enquiries.
 *
 * Counted with the service role because that is the only way to get a true
 * count: an admin holding `user.support` cannot necessarily read every enquiry
 * or message, and a count filtered by RLS would report "nothing in the way" for
 * an account that has plenty.
 *
 * Written out rather than looped over a table/column list: the generated types
 * narrow `.eq()` to the columns the table actually has, and a loop collapses
 * that to the columns all four share. The repetition is what keeps this checked
 * against the real schema, so a renamed column fails the build.
 */
export async function getAccountBlockers(userId: string): Promise<string[]> {
  const admin = createAdminClient()
  const head = { count: 'exact' as const, head: true }

  const [enquiries, reviews, messages, vendors] = await Promise.all([
    admin.from('enquiries').select('*', head).eq('customer_id', userId),
    admin.from('reviews').select('*', head).eq('customer_id', userId),
    admin.from('messages').select('*', head).eq('sender_user_id', userId),
    admin.from('vendors').select('*', head).eq('owner_user_id', userId),
  ])

  for (const result of [enquiries, reviews, messages, vendors]) {
    if (result.error) throw result.error
  }

  return [
    phrase(enquiries.count ?? 0, 'enquiry', 'enquiries'),
    phrase(reviews.count ?? 0, 'review', 'reviews'),
    phrase(messages.count ?? 0, 'message', 'messages'),
    phrase(vendors.count ?? 0, 'business', 'businesses'),
  ].filter((value): value is string => value !== null)
}

/** True when this account carries admin access of any kind. */
export async function hasAdminAccess(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from('admin_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) throw error
  return (count ?? 0) > 0
}

/**
 * Deletes the auth record, and everything that cascades from it.
 *
 * Returns the provider's message rather than throwing, so the caller can turn
 * it into something a person reads. A failure here means nothing was deleted —
 * the cascade runs in one transaction.
 */
export async function deleteAuthUser(userId: string): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) {
    logError('customer.delete.failed', error, { userId, message: error.message })
    return { error: error.message }
  }

  return { error: null }
}
