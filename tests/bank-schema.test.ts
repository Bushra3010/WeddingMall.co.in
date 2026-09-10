import { describe, expect, it } from 'vitest'

import { bankAccountSchema, maskAccountNumber } from '@/features/vendors/bank-schema'

/**
 * Payout details — the boundary money crosses.
 *
 * Every rule here is mirrored by a CHECK constraint in migration 0038, which is
 * the guarantee; this is the version that produces a sentence a vendor can act
 * on. Both directions matter: a rule that is only in Zod is bypassed by a
 * service-role script, and a rule that is only in SQL surfaces as a constraint
 * name.
 */

const BASE = {
  accountHolderName: 'Marigold Courtyard Events',
  accountNumber: '50100234567890',
  confirmAccountNumber: '50100234567890',
  ifsc: 'HDFC0001234',
  bankName: '',
  branchName: '',
  accountType: 'current' as const,
  upiId: '',
}

describe('bankAccountSchema', () => {
  it('accepts a well-formed account', () => {
    expect(bankAccountSchema.safeParse(BASE).success).toBe(true)
  })

  it('accepts an account number copied with the spacing a statement prints', () => {
    /*
     * Bank statements group the digits. Validating before stripping separators
     * would tell a vendor their own account number is invalid, which is the
     * kind of refusal people retype three times and then give up on.
     */
    const parsed = bankAccountSchema.parse({
      ...BASE,
      accountNumber: '5010 0234 567890',
      confirmAccountNumber: '5010-0234-567890',
    })
    expect(parsed.accountNumber).toBe('50100234567890')
  })

  it('refuses two account numbers that do not match', () => {
    // The only check that exists before money moves: a single wrong digit is a
    // perfectly valid account number belonging to somebody else.
    const result = bankAccountSchema.safeParse({
      ...BASE,
      confirmAccountNumber: '50100234567891',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmAccountNumber'])
  })

  it('refuses anything that is not digits in the account number', () => {
    for (const accountNumber of ['not-a-number', '12345', '+919876543210', '']) {
      const result = bankAccountSchema.safeParse({
        ...BASE,
        accountNumber,
        confirmAccountNumber: accountNumber,
      })
      expect(result.success, accountNumber).toBe(false)
    }
  })

  it('enforces the RBI IFSC format, and upper-cases a lowercase one', () => {
    expect(bankAccountSchema.parse({ ...BASE, ifsc: 'hdfc0001234' }).ifsc).toBe('HDFC0001234')

    for (const ifsc of [
      'HDFC1001234', // fifth character must be a zero
      'HD FC0001234', // spaces
      'HDFC000123', // ten characters
      'HDFC00012345', // twelve
      '1234HDFC000', // digits where the bank code goes
    ]) {
      expect(bankAccountSchema.safeParse({ ...BASE, ifsc }).success, ifsc).toBe(false)
    }
  })

  it('accepts a blank UPI ID but not a malformed one', () => {
    expect(bankAccountSchema.safeParse({ ...BASE, upiId: '' }).success).toBe(true)
    expect(bankAccountSchema.safeParse({ ...BASE, upiId: 'marigold@okhdfc' }).success).toBe(true)
    expect(bankAccountSchema.safeParse({ ...BASE, upiId: 'not-a-upi' }).success).toBe(false)
  })

  it('refuses an account type outside the two the table allows', () => {
    expect(bankAccountSchema.safeParse({ ...BASE, accountType: 'overdraft' }).success).toBe(false)
  })
})

describe('maskAccountNumber', () => {
  it('shows the last four and nothing else', () => {
    expect(maskAccountNumber('50100234567890')).toBe('••••••••••7890')
  })

  it('never lets the mask hint at the length of a long number', () => {
    /*
     * Capped at twelve dots. An unbounded mask leaks the digit count, which is
     * one of the two things needed to pay into an account — and the number of
     * dots is not information anybody reading this screen needs.
     */
    const masked = maskAccountNumber('9'.repeat(20))
    expect(masked).toBe(`${'•'.repeat(12)}9999`)
  })

  it('reveals nothing at all for a number too short to mask', () => {
    expect(maskAccountNumber('1234')).toBe('••••')
    expect(maskAccountNumber('12')).toBe('••')
  })

  it('ignores separators when counting the last four', () => {
    expect(maskAccountNumber('5010 0234 567890')).toBe('••••••••••7890')
  })
})
