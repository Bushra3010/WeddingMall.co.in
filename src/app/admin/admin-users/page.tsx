import { GrantRoleForm, RevokeRoleForm } from '@/components/admin/admin-user-forms'
import { EmptyState } from '@/components/ui/states'
import { formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { requireElevatedAdmin } from '@/server/policies/require'

export const metadata = { title: 'Administrators', ...NOINDEX }
export const dynamic = 'force-dynamic'

/** Everything except `super_admin` — see the note rendered on the page. */
const GRANTABLE = [
  'operations_admin',
  'vendor_verifier',
  'content_admin',
  'support_agent',
  'finance_admin',
  'analyst',
]

export default async function AdminUsersPage() {
  await requireElevatedAdmin('admin.manage')
  const supabase = await createClient()

  const [{ data: memberships }, { data: profiles }] = await Promise.all([
    supabase
      .from('admin_memberships')
      // `admin_memberships` has two FKs to `profiles` (user_id and
      // invited_by), so the embed must name the constraint — an unhinted one
      // is ambiguous and PostgREST answers 300 at runtime.
      .select(
        'id, status, created_at, user_id, admin_roles(code), profiles!admin_memberships_user_id_fkey(full_name)',
      )
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').order('full_name').limit(200),
  ])

  const accounts = (profiles ?? []).map((row) => ({
    id: row.id,
    label: row.full_name ?? `Unnamed account ${row.id.slice(0, 8)}`,
  }))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Administrators</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Who can act on the platform, and as what. Every grant and revocation is written to the
          audit log.
        </p>
      </header>

      <p className="border-sand-200 text-sand-700 max-w-prose rounded-[var(--radius-card)] border bg-white px-4 py-3 text-sm">
        {/*
          Stated on the page, not just enforced in the action: an administrator
          who cannot find the control will otherwise assume it is missing and
          go looking for a workaround.
        */}
        <strong className="text-sand-900">super_admin cannot be granted here.</strong> A Server
        Action is a public endpoint, and the super-admin role must not be creatable through public
        input — so the only path is{' '}
        <code className="text-xs">npm run grant-admin -- someone@example.com super_admin</code>,
        which runs out of band with the service key and records an audit entry.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div>
          {(memberships ?? []).length === 0 ? (
            <EmptyState
              title="No administrators"
              description="Grant the first role with the form beside this."
            />
          ) : (
            <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
              <table className="w-full min-w-[30rem] text-sm">
                <caption className="sr-only">Administrator roles</caption>
                <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Person
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Granted
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-sand-200 divide-y bg-white">
                  {(memberships ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="text-sand-900 px-4 py-3 font-medium">
                        {row.profiles?.full_name ?? 'Unnamed account'}
                      </td>
                      <td className="text-sand-700 px-4 py-3 font-mono text-xs">
                        {row.admin_roles?.code ?? '—'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3',
                          row.status === 'active' ? 'text-[var(--color-success)]' : 'text-sand-500',
                        )}
                      >
                        {row.status}
                      </td>
                      <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                        {formatRelative(row.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.status === 'active' ? <RevokeRoleForm id={row.id} /> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
          <h2 className="font-display text-sand-900 mb-4 text-lg">Grant a role</h2>
          <GrantRoleForm accounts={accounts} roles={GRANTABLE} />
        </div>
      </div>
    </div>
  )
}
