'use client'

import { useFormStatus } from 'react-dom'

import { FormMessage, fieldError, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field } from '@/components/ui/field'
import { grantAdminRoleAction, revokeAdminRoleAction } from '@/features/admin/actions'

const SELECT = 'border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm'

export function GrantRoleForm({
  accounts,
  roles,
}: {
  accounts: { id: string; label: string }[]
  roles: string[]
}) {
  const [state, action] = useAction(grantAdminRoleAction)

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} successMessage="Role granted." />

      <Field label="Account" required error={fieldError(state, 'userId')}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="userId"
            required
            className={SELECT}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          >
            <option value="">Choose an account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        label="Role"
        required
        hint="super_admin is not grantable here — see the note below."
        error={fieldError(state, 'roleCode')}
      >
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="roleCode"
            required
            className={SELECT}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        )}
      </Field>

      <SubmitButton pendingLabel="Granting…">Grant role</SubmitButton>
    </form>
  )
}

function RevokeButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50"
    >
      {pending ? 'Revoking…' : 'Revoke'}
    </button>
  )
}

export function RevokeRoleForm({ id }: { id: string }) {
  const [state, action] = useAction(revokeAdminRoleAction)

  return (
    <form action={action} className="flex items-center justify-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="max-w-72">
        <FormMessage state={state} />
      </div>
      <RevokeButton />
    </form>
  )
}
