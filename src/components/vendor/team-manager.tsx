'use client'

import { UserPlus } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import {
  changeMemberRoleAction,
  inviteMemberAction,
  revokeMemberAction,
} from '@/features/vendors/actions'
import { canGrantVendorRole, VENDOR_ROLES, type VendorRole } from '@/lib/permissions'
import type { TeamMember } from '@/server/dal/vendor-workspace'

const ROLE_LABELS: Record<VendorRole, string> = {
  vendor_owner: 'Owner — full access including billing',
  vendor_manager: 'Manager — listing, packages, enquiries, team',
  vendor_sales: 'Sales — enquiries and conversations only',
  vendor_editor: 'Editor — listing and media, no lead contact details',
  vendor_viewer: 'Viewer — read-only analytics',
}

export function TeamManager({
  vendorId,
  members,
  actorRole,
  canManage,
}: {
  vendorId: string
  members: TeamMember[]
  actorRole: VendorRole | null
  canManage: boolean
}) {
  const [inviteState, invite] = useAction(inviteMemberAction)
  const [roleState, changeRole] = useAction(changeMemberRoleAction)
  const [revokeState, revoke] = useAction(revokeMemberAction)

  // Only offer roles this member is actually allowed to grant. The server and
  // the database both re-check, so this is convenience, not enforcement.
  const grantable = VENDOR_ROLES.filter(
    (role) => actorRole !== null && canGrantVendorRole(actorRole, role),
  )

  return (
    <div className="space-y-6">
      <FormMessage state={roleState} successMessage="Role updated." />
      <FormMessage state={revokeState} successMessage="Team member removed." />

      <div className="border-sand-200 overflow-hidden rounded-[var(--radius-card)] border bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">Team members and their roles</caption>
          <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Member
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Role
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-sand-200 divide-y">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3">
                  <p className="text-sand-900 font-medium">
                    {member.fullName ?? member.invitedEmail ?? 'Pending member'}
                  </p>
                  {member.isOwner ? (
                    <span className="text-sand-500 text-xs">Business owner</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {canManage && !member.isOwner ? (
                    <form action={changeRole} className="flex items-center gap-2">
                      <input type="hidden" name="vendorId" value={vendorId} />
                      <input type="hidden" name="membershipId" value={member.id} />
                      <label className="sr-only" htmlFor={`role-${member.id}`}>
                        Role for {member.fullName ?? member.invitedEmail}
                      </label>
                      <select
                        id={`role-${member.id}`}
                        name="role"
                        defaultValue={member.role}
                        className="border-sand-300 h-9 rounded-lg border bg-white px-2 text-xs"
                      >
                        {grantable.map((role) => (
                          <option key={role} value={role}>
                            {role.replace('vendor_', '')}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="ghost" size="sm">
                        Save
                      </Button>
                    </form>
                  ) : (
                    <span className="text-sand-700">{member.role.replace('vendor_', '')}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      member.status === 'active'
                        ? 'text-[var(--color-success)]'
                        : member.status === 'invited'
                          ? 'text-sand-600'
                          : 'text-sand-400'
                    }
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && !member.isOwner && member.status !== 'revoked' ? (
                    <form action={revoke}>
                      <input type="hidden" name="vendorId" value={vendorId} />
                      <input type="hidden" name="membershipId" value={member.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Remove
                      </Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <form
          action={invite}
          className="border-sand-200 space-y-4 rounded-[var(--radius-card)] border bg-white p-5"
        >
          <h2 className="font-display text-sand-900 text-lg">Invite a colleague</h2>
          <input type="hidden" name="vendorId" value={vendorId} />
          <FormMessage state={inviteState} successMessage="Invitation sent." />

          <p className="text-sand-600 text-sm">
            They need an account here first — ask them to sign up, then invite that email.
          </p>

          <Field label="Email address" error={fieldError(inviteState, 'email')} required>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="email"
                type="email"
                required
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field label="Role" error={fieldError(inviteState, 'role')} required>
            {({ id }) => (
              <select
                id={id}
                name="role"
                defaultValue="vendor_sales"
                className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
              >
                {grantable.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <SubmitButton pendingLabel="Inviting…">
            <UserPlus aria-hidden="true" />
            Send invitation
          </SubmitButton>
        </form>
      ) : null}
    </div>
  )
}
