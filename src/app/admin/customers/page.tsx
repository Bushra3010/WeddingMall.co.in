import { DeleteRowButton } from '@/components/admin/delete-row-button'
import { EmptyState } from '@/components/ui/states'
import { deleteCustomerAction } from '@/features/admin/customer-actions'
import { formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { requireElevatedAdmin } from '@/server/policies/require'

export const metadata = { title: 'Customers', ...NOINDEX }
export const dynamic = 'force-dynamic'

/**
 * Customer accounts for support (PRD 6.11).
 *
 * Gated on `user.support`, and shows activity counts rather than contact
 * details. A support agent needs to know that an account exists and what it
 * has done; reading a customer's phone number is a PII reveal, which belongs
 * on the specific enquiry where consent was given and where the release is
 * audited (`getCustomerContact`). A browsable directory of contact details
 * would route around that entirely.
 */
export default async function AdminCustomersPage() {
  const actor = await requireElevatedAdmin('user.support')
  const supabase = await createClient()

  /*
   * Deliberately stricter than the page itself. Browsing accounts is
   * `user.support`; removing one is irreversible and takes the person's
   * sign-in with it, so it is super-admin only — the same bar as deleting a
   * business. The service re-checks; this only decides what to render.
   */
  const canDelete = can(actor, 'admin.manage')

  const [
    { data: profiles },
    { data: enquiries },
    { data: reviews },
    { data: shortlists },
    { data: messages },
    { data: ownedVendors },
    { data: adminMemberships },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('enquiries').select('customer_id'),
    supabase.from('reviews').select('customer_id'),
    supabase.from('shortlists').select('user_id'),
    // The last three are for the delete guard, not the counts columns.
    supabase.from('messages').select('sender_user_id'),
    supabase.from('vendors').select('owner_user_id'),
    supabase.from('admin_memberships').select('user_id').eq('status', 'active'),
  ])

  const tally = (rows: { [k: string]: unknown }[] | null, key: string) => {
    const map = new Map<string, number>()
    for (const row of rows ?? []) {
      const id = row[key] as string
      if (id) map.set(id, (map.get(id) ?? 0) + 1)
    }
    return map
  }

  const byEnquiry = tally(enquiries, 'customer_id')
  const byReview = tally(reviews, 'customer_id')
  const byShortlist = tally(shortlists, 'user_id')
  const byMessage = tally(messages, 'sender_user_id')
  const byOwnedVendor = tally(ownedVendors, 'owner_user_id')
  const admins = new Set((adminMemberships ?? []).map((row) => row.user_id))

  /*
   * Why an account cannot be deleted, worked out before the button is drawn.
   *
   * These mirror the refusals in `deleteCustomerAsAdmin`, which is still the
   * authority — this only decides what to render. Offering a button that is
   * going to be refused is a dead end, and most accounts here are refused:
   * anyone who registered a business owns one, and `vendors.owner_user_id` is
   * `on delete restrict`.
   */
  function blockedBecause(id: string): string | null {
    if (id === actor.userId) return 'This is you'
    if (admins.has(id)) return 'Administrator'

    const parts = [
      byEnquiry.get(id) ? 'enquiries' : null,
      byReview.get(id) ? 'reviews' : null,
      byMessage.get(id) ? 'messages' : null,
      byOwnedVendor.get(id) ? 'a business' : null,
    ].filter((value): value is string => value !== null)

    return parts.length > 0 ? `Has ${parts.join(', ')}` : null
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Customers</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Accounts and what they have done. Contact details are not listed here — they are released
          per enquiry with the customer&apos;s consent, and each release is recorded in the audit
          log.
        </p>
      </header>

      {(profiles ?? []).length === 0 ? (
        <EmptyState title="No accounts yet" description="Customer accounts appear here." />
      ) : (
        <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
          <table className="w-full min-w-[38rem] text-sm">
            <caption className="sr-only">Customer accounts</caption>
            <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Enquiries
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Shortlisted
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Reviews
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Joined
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-sand-200 divide-y bg-white">
              {(profiles ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="text-sand-900 px-4 py-3 font-medium">
                    {row.full_name ?? <span className="text-sand-500">Unnamed account</span>}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3',
                      row.status === 'active' ? 'text-sand-700' : 'text-[var(--color-danger)]',
                    )}
                  >
                    {row.status}
                  </td>
                  <td className="text-sand-700 px-4 py-3">{byEnquiry.get(row.id) ?? 0}</td>
                  <td className="text-sand-700 px-4 py-3">{byShortlist.get(row.id) ?? 0}</td>
                  <td className="text-sand-700 px-4 py-3">{byReview.get(row.id) ?? 0}</td>
                  <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                    {formatRelative(row.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!canDelete ? null : blockedBecause(row.id) ? (
                      <span className="text-sand-500 text-xs whitespace-nowrap">
                        {blockedBecause(row.id)}
                      </span>
                    ) : (
                      <DeleteRowButton
                        id={row.id}
                        label={row.full_name ?? 'this account'}
                        action={deleteCustomerAction}
                        warning="The account and its sign-in are removed for good, along with the shortlist and notifications. This cannot be undone."
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
