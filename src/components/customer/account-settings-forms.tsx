'use client'

import { FormMessage, fieldError, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { saveNotificationPrefsAction, saveProfileAction } from '@/features/privacy/settings-actions'

export function ProfileForm({
  fullName,
  phone,
  phoneVerified,
}: {
  fullName: string | null
  phone: string | null
  phoneVerified: boolean
}) {
  const [state, action] = useAction(saveProfileAction)

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} successMessage="Saved." />

      <Field label="Your name" error={fieldError(state, 'fullName')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="fullName"
            defaultValue={fullName ?? ''}
            maxLength={120}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field
        label="Phone"
        hint={
          phoneVerified
            ? 'Verified. Changing it will require verifying again.'
            : 'Only shared with a vendor when you choose to on a specific enquiry.'
        }
        error={fieldError(state, 'phone')}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="phone"
            type="tel"
            defaultValue={phone ?? ''}
            maxLength={20}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
    </form>
  )
}

export function NotificationPrefsForm({
  groups,
}: {
  groups: { key: string; label: string; description: string; enabled: boolean }[]
}) {
  const [state, action] = useAction(saveNotificationPrefsAction)

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} successMessage="Preferences saved." />

      <ul className="divide-sand-100 divide-y">
        {groups.map((group) => (
          <li key={group.key} className="flex items-start gap-3 py-3">
            {/*
              The group name rides along in a hidden field so the action knows
              which switches were on the page. An unchecked box submits nothing,
              so without this an opt-out would be indistinguishable from a group
              that was never rendered.
            */}
            <input type="hidden" name="group" value={group.key} />
            <input
              id={`enabled-${group.key}`}
              type="checkbox"
              name={`enabled:${group.key}`}
              defaultChecked={group.enabled}
              className="accent-brand-700 mt-1 size-4"
            />
            <label htmlFor={`enabled-${group.key}`} className="flex-1">
              <span className="text-sand-900 block text-sm font-medium">{group.label}</span>
              <span className="text-sand-600 block text-xs">{group.description}</span>
            </label>
          </li>
        ))}
      </ul>

      <SubmitButton pendingLabel="Saving…">Save preferences</SubmitButton>
    </form>
  )
}
