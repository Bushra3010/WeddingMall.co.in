import { z } from 'zod'

/**
 * Payout bank details (migration 0038).
 *
 * Every rule here is mirrored by a CHECK constraint on the table, because Zod
 * runs in one code path and the table is written by several — a support script,
 * an import, a future payout reconciliation job. The constraint is the
 * guarantee; this is the version that produces a sentence a vendor can act on.
 */

const trimmed = (max: number) => z.string().trim().max(max)

/**
 * Four letters, a zero, then six alphanumerics. That is the RBI's format and it
 * has not changed since 2005, so a bad IFSC is a typo rather than an unusual
 * bank.
 */
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/

/**
 * Indian account numbers run 9-18 digits depending on the bank; a few
 * co-operative banks are shorter. 6-20 is wide enough not to reject a real
 * account and narrow enough to catch a phone number pasted into the wrong box.
 */
export const ACCOUNT_NUMBER_PATTERN = /^\d{6,20}$/

export const ACCOUNT_TYPES = [
  { value: 'savings', label: 'Savings' },
  { value: 'current', label: 'Current' },
] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]['value']

export const bankAccountSchema = z
  .object({
    accountHolderName: trimmed(120).min(2, 'Enter the name exactly as it appears on the account'),
    accountNumber: z
      .string()
      .trim()
      // Bank statements print account numbers in groups. Stripping separators
      // before validating means a vendor copying "5011 2345 6789" is not told
      // their own account number is invalid.
      .transform((value) => value.replace(/[\s-]/g, ''))
      .pipe(
        z
          .string()
          .regex(ACCOUNT_NUMBER_PATTERN, 'Enter the account number — digits only, 6 to 20 of them'),
      ),
    /**
     * Typed twice on purpose.
     *
     * A wrong digit in an account number is not caught by any validation that
     * exists — it is a valid account number, belonging to somebody else, and
     * the first symptom is a payment that has already left. Re-entry is the only
     * check available before the money moves.
     */
    confirmAccountNumber: z
      .string()
      .trim()
      .transform((value) => value.replace(/[\s-]/g, '')),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(IFSC_PATTERN, 'That is not a valid IFSC — 11 characters, like HDFC0001234'),
    bankName: trimmed(120).optional().or(z.literal('')),
    branchName: trimmed(120).optional().or(z.literal('')),
    accountType: z.enum(ACCOUNT_TYPES.map((t) => t.value) as [AccountType, ...AccountType[]]),
    upiId: trimmed(120)
      .regex(/^$|^[\w.\-]{2,64}@[a-zA-Z]{2,64}$/, 'Enter a UPI ID like name@bank')
      .optional()
      .or(z.literal('')),
  })
  .refine((value) => value.accountNumber === value.confirmAccountNumber, {
    message: 'The two account numbers do not match',
    path: ['confirmAccountNumber'],
  })

export type BankAccountInput = z.infer<typeof bankAccountSchema>

/**
 * `••••••3456` — what an admin sees before revealing.
 *
 * Last four only. Enough to confirm which account is on file against a cheque
 * or a vendor reading it out over the phone, and not enough to pay into.
 */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, '')
  if (digits.length <= 4) return '•'.repeat(digits.length)
  return `${'•'.repeat(Math.min(digits.length - 4, 12))}${digits.slice(-4)}`
}
