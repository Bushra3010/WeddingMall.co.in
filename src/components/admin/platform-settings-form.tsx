'use client'

import { FormMessage, fieldError, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { savePlatformPolicyAction } from '@/features/admin/actions'

export function PlatformSettingsForm({
  firstResponseHours,
  reviewEditWindowHours,
}: {
  firstResponseHours: number
  reviewEditWindowHours: number
}) {
  const [state, action] = useAction(savePlatformPolicyAction)

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} successMessage="Settings saved." />

      <Field
        label="Response deadline (hours)"
        required
        hint="Measured from delivery, not from when the customer wrote it. Vendor dashboards highlight anything past this."
        error={fieldError(state, 'firstResponseHours')}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="firstResponseHours"
            type="number"
            min={1}
            max={720}
            required
            defaultValue={firstResponseHours}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field
        label="Review edit window (hours)"
        required
        hint="How long an author may edit. Editing always sends the review back for moderation, whatever this is set to."
        error={fieldError(state, 'reviewEditWindowHours')}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="reviewEditWindowHours"
            type="number"
            min={0}
            max={8760}
            required
            defaultValue={reviewEditWindowHours}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
    </form>
  )
}
