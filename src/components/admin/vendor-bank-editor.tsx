'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import {
  adminDeleteBankAccountAction,
  adminSaveBankAccountAction,
} from '@/features/admin/vendor-support-actions'
import { ACCOUNT_TYPES } from '@/features/vendors/bank-schema'

/**
 * Entering a business's payout details from the admin panel (migration 0040).
 *
 * ## Optional, and it says so
 *
 * Nothing depends on these. A business goes live, takes enquiries and is
 * verified without them — payout details exist so that money can be sent when
 * there is money to send, and an empty section here means "not collected yet",
 * never "unfinished". The Bank step in the vendor's own wizard carries
 * `optional: true` for the same reason.
 *
 * ## The account number is never rendered
 *
 * Not here either. The page holds `••••••3456` from
 * `getBankAccountSummary` — masking a full number in the markup would be
 * theatre, since a Server Component's props are serialised into the HTML.
 * So there is no "edit the number" affordance, only "replace", and replacing
 * means typing it twice. That is the right shape anyway: a wrong digit is a
 * valid account number belonging to somebody else, and re-entry is the only
 * check that exists before money moves.
 *
 * ## Who
 *
 * `billing.manage`. A `vendor.verify` admin can read these details — that is
 * what checking a cancelled cheque against a name requires — and cannot change
 * them. RLS says the same thing, and refuses regardless of what this component
 * decided.
 */
export function VendorBankEditor({
  vendorId,
  hasAccount,
  canManage,
  defaults,
}: {
  vendorId: string
  hasAccount: boolean
  canManage: boolean
  /** Everything except the digits — used to prefill a replacement. */
  defaults: {
    accountHolderName: string
    ifsc: string
    accountType: string
    bankName: string | null
    branchName: string | null
    upiId: string | null
  } | null
}) {
  const [saveState, save] = useAction(adminSaveBankAccountAction)
  const [deleteState, remove] = useAction(adminDeleteBankAccountAction)

  // Replacing details already on file is a deliberate act, not something to
  // fall into by tabbing through a prefilled form.
  const [editing, setEditing] = useState(false)
  const showForm = canManage && (!hasAccount || editing)

  if (!canManage) {
    return (
      <p className="border-sand-200 text-sand-500 mt-4 border-t pt-4 text-xs">
        Changing payout details needs the billing.manage permission. Reading them, to check a cheque
        against the name, does not.
      </p>
    )
  }

  return (
    <div className="border-sand-200 mt-4 space-y-3 border-t pt-4">
      <FormMessage state={deleteState} successMessage="Payout details removed." />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="border-sand-300 text-sand-700 hover:bg-sand-100 inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium"
        >
          {editing ? 'Cancel' : hasAccount ? 'Replace details' : 'Add payout details'}
        </button>

        {hasAccount ? (
          <form action={remove}>
            <input type="hidden" name="vendorId" value={vendorId} />
            <button
              type="submit"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--color-danger)] px-3 text-xs font-medium text-[var(--color-danger)]"
            >
              <Trash2 aria-hidden="true" className="size-3" />
              Remove
            </button>
          </form>
        ) : null}
      </div>

      {showForm ? (
        <form action={save} className="space-y-4 pt-1">
          <input type="hidden" name="vendorId" value={vendorId} />
          <FormMessage state={saveState} successMessage="Payout details saved." />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Account holder name"
              hint="Exactly as the bank has it, including initials."
              error={fieldError(saveState, 'accountHolderName')}
              required
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="accountHolderName"
                  required
                  autoComplete="off"
                  defaultValue={defaults?.accountHolderName ?? ''}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field
              label="IFSC"
              hint="11 characters, like HDFC0001234."
              error={fieldError(saveState, 'ifsc')}
              required
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="ifsc"
                  required
                  autoComplete="off"
                  maxLength={11}
                  placeholder="HDFC0001234"
                  defaultValue={defaults?.ifsc ?? ''}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="font-mono uppercase"
                />
              )}
            </Field>

            {/*
              `autoComplete="off"` and no `defaultValue` on either number field.
              The browser must not offer to fill or remember an account number,
              and it must not autofill the confirmation from the first — that
              would defeat the only check there is.
            */}
            <Field
              label="Account number"
              hint="Digits only. Spaces and dashes are ignored."
              error={fieldError(saveState, 'accountNumber')}
              required
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="accountNumber"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="font-mono"
                />
              )}
            </Field>

            <Field
              label="Confirm account number"
              hint="Type it again — a wrong digit is a valid account belonging to someone else."
              error={fieldError(saveState, 'confirmAccountNumber')}
              required
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="confirmAccountNumber"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  onPaste={(event) => event.preventDefault()}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="font-mono"
                />
              )}
            </Field>

            <Field label="Account type" error={fieldError(saveState, 'accountType')} required>
              {({ id, describedBy, invalid }) => (
                <select
                  id={id}
                  name="accountType"
                  required
                  defaultValue={defaults?.accountType ?? 'savings'}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Bank name" error={fieldError(saveState, 'bankName')}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="bankName"
                  defaultValue={defaults?.bankName ?? ''}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field label="Branch" error={fieldError(saveState, 'branchName')}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="branchName"
                  defaultValue={defaults?.branchName ?? ''}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field
              label="UPI ID"
              hint="Optional, for small or fast payouts."
              error={fieldError(saveState, 'upiId')}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="upiId"
                  placeholder="name@bank"
                  defaultValue={defaults?.upiId ?? ''}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>

          <p className="text-sand-500 text-xs">
            {hasAccount
              ? 'Saving new details clears the verification on the old ones — the check was made against the account being replaced.'
              : 'Optional. Nothing else waits on this: a business can be published, verified and taking enquiries without payout details on file.'}{' '}
            This change is recorded against your account.
          </p>

          <SubmitButton pendingLabel="Saving…">
            {hasAccount ? 'Replace payout details' : 'Save payout details'}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  )
}
