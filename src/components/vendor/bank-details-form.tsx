'use client'

import { useState } from 'react'
import { BadgeCheck, Landmark, ShieldAlert, Trash2 } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import {
  deleteBankAccountAction,
  saveBankAccountAction,
  uploadChequeAction,
} from '@/features/vendors/bank-actions'
import { ACCOUNT_TYPES } from '@/features/vendors/bank-schema'
import type { BankAccountSummary } from '@/server/dal/vendor-bank'

/**
 * Payout bank details, and the cancelled cheque that backs them.
 *
 * ## The account number is never rendered
 *
 * Not even to the vendor who typed it. The page receives
 * {@link BankAccountSummary}, which carries `••••••3456` and nothing more —
 * masking in the markup would be theatre, because a Server Component's props are
 * serialised into the HTML and View Source would show every digit.
 *
 * That means there is no "edit the account number" affordance, only "replace
 * it", and replacing means typing it twice again. That is the right shape
 * anyway: a wrong digit is a valid account number belonging to somebody else,
 * and re-entry is the only check that exists before money moves.
 *
 * ## Who sees this
 *
 * `billing.manage`, which `vendor_can()` grants to `vendor_owner` alone — not
 * `listing.edit`, which a hired editor or agency holds. When the viewer lacks
 * it the form is replaced by a sentence saying so, and the server refuses
 * independently regardless of what this component decided (CLAUDE.md invariant
 * 2).
 */
export function BankDetailsForm({
  vendorId,
  account,
  canManage,
}: {
  vendorId: string
  account: BankAccountSummary | null
  canManage: boolean
}) {
  const [saveState, save] = useAction(saveBankAccountAction)
  const [chequeState, uploadCheque] = useAction(uploadChequeAction)
  const [deleteState, remove] = useAction(deleteBankAccountAction)

  // Replacing details already on file is a deliberate act, not something to fall
  // into by tabbing through a prefilled form.
  const [replacing, setReplacing] = useState(false)
  const showForm = canManage && (!account || replacing)

  return (
    <div className="space-y-4">
      <p className="text-sand-600 text-sm">
        Where we send your money. These details are private — never shown on your public profile,
        and visible only to you and the team that processes payouts.
      </p>

      {!canManage ? (
        <p className="border-sand-300 text-sand-600 rounded-lg border border-dashed p-4 text-sm">
          Only the business owner can view or change payout details. Ask whoever owns this account
          to add them.
        </p>
      ) : null}

      {account ? (
        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="bg-brand-50 text-brand-700 flex size-9 shrink-0 items-center justify-center rounded-xl">
                <Landmark aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sand-900 text-sm font-medium">{account.accountHolderName}</p>
                <p className="text-sand-600 font-mono text-sm">{account.accountNumberMasked}</p>
                <p className="text-sand-500 mt-0.5 text-xs">
                  {account.ifsc} · {account.accountType}
                  {account.bankName ? ` · ${account.bankName}` : ''}
                  {account.branchName ? `, ${account.branchName}` : ''}
                </p>
                {account.upiId ? (
                  <p className="text-sand-500 mt-0.5 text-xs">UPI {account.upiId}</p>
                ) : null}
              </div>
            </div>

            {account.verifiedAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--color-success)_12%,white)] px-2.5 py-1 text-xs text-[var(--color-success)]">
                <BadgeCheck aria-hidden="true" className="size-3.5" />
                Verified
              </span>
            ) : (
              <span className="bg-sand-100 text-sand-600 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
                <ShieldAlert aria-hidden="true" className="size-3.5" />
                Awaiting check
              </span>
            )}
          </div>

          {/*
            The full number is deliberately unavailable here. If a vendor cannot
            confirm the digits from the last four, replacing is the safe answer —
            and re-typing it twice is exactly the check that catches the typo.
          */}
          <p className="text-sand-500 mt-3 text-xs">
            Only the last four digits are shown. To correct the number, replace the details — you
            will be asked to type it twice.
          </p>

          {canManage ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReplacing((value) => !value)}
                className="border-sand-300 text-sand-700 hover:bg-sand-100 inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium"
              >
                {replacing ? 'Cancel' : 'Replace details'}
              </button>

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
            </div>
          ) : null}
        </div>
      ) : canManage ? (
        <p className="border-sand-300 text-sand-600 rounded-lg border border-dashed p-4 text-sm">
          No payout details yet. Add them so we can pay out on bookings taken through the site.
        </p>
      ) : null}

      <FormMessage state={deleteState} successMessage="Payout details removed." />

      {showForm ? (
        <form action={save} className="border-sand-200 space-y-4 border-t pt-4">
          <input type="hidden" name="vendorId" value={vendorId} />
          <FormMessage state={saveState} successMessage="Payout details saved." />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Account holder name"
              hint="Exactly as your bank has it, including initials."
              error={fieldError(saveState, 'accountHolderName')}
              required
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="accountHolderName"
                  required
                  autoComplete="off"
                  defaultValue={account?.accountHolderName ?? ''}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field
              label="IFSC"
              hint="11 characters, like HDFC0001234. On your cheque book."
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
                  defaultValue={account?.ifsc ?? ''}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="font-mono uppercase"
                />
              )}
            </Field>

            {/*
              `autoComplete="off"` and `spellCheck={false}` on both number
              fields, and no `defaultValue` on either. The browser must not
              offer to fill or remember an account number, and it must not
              autofill the confirmation from the first — that would defeat the
              only check there is.
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
                  defaultValue={account?.accountType ?? 'savings'}
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
                  defaultValue={account?.bankName ?? ''}
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
                  defaultValue={account?.branchName ?? ''}
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
                  defaultValue={account?.upiId ?? ''}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>

          {account ? (
            <p className="text-sand-500 text-xs">
              Saving new details clears the verification on the old ones — the check was made
              against the account being replaced.
            </p>
          ) : null}

          <SubmitButton pendingLabel="Saving…">
            {account ? 'Replace payout details' : 'Save payout details'}
          </SubmitButton>
        </form>
      ) : null}

      {canManage ? (
        <form action={uploadCheque} className="border-sand-200 space-y-3 border-t pt-4">
          <input type="hidden" name="vendorId" value={vendorId} />

          <div>
            <h3 className="text-sand-900 text-sm font-medium">Cancelled cheque</h3>
            <p className="text-sand-500 mt-0.5 text-xs">
              A photo of a cheque with &ldquo;CANCELLED&rdquo; written across it, or your passbook
              page. It is how we check the account matches the business. PDF, JPEG or PNG, up to
              10&nbsp;MB.
            </p>
          </div>

          {/*
            Not a `FormMessage`: the upload can succeed while the attach does
            not — the file is stored either way — and one boolean cannot say
            that. `reason` carries the server's own sentence when it happens.
          */}
          {chequeState?.ok ? (
            <p
              role="status"
              className={
                chequeState.data.attached
                  ? 'rounded-lg bg-[color-mix(in_oklch,var(--color-success)_12%,white)] px-3 py-2 text-sm text-[var(--color-success)]'
                  : 'bg-accent-100 text-accent-700 rounded-lg px-3 py-2 text-sm'
              }
            >
              {chequeState.data.attached
                ? 'Cheque uploaded and attached to your payout details.'
                : (chequeState.data.reason ??
                  'Cheque uploaded. It will be attached once your account details are saved.')}
            </p>
          ) : (
            <FormMessage state={chequeState} />
          )}

          {account?.chequeDocumentId ? (
            <p className="text-sand-600 text-xs">
              A cheque is already on file. Uploading another replaces it.
            </p>
          ) : null}

          <div>
            <label
              htmlFor={`cheque-${vendorId}`}
              className="text-sand-800 block text-sm font-medium"
            >
              File <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              id={`cheque-${vendorId}`}
              type="file"
              name="file"
              accept="image/jpeg,image/png,application/pdf"
              required
              className="border-sand-300 mt-1.5 block w-full rounded-lg border bg-white p-2 text-sm"
            />
          </div>

          <SubmitButton pendingLabel="Uploading…">Upload cheque</SubmitButton>
        </form>
      ) : null}
    </div>
  )
}
