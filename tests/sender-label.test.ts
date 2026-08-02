import { describe, expect, it } from 'vitest'

import { senderLabel } from '@/features/messaging/sender-label'

/**
 * The regression these guard against was a disclosure, not a cosmetic slip: a
 * third party's messages were announced to a vendor as the customer's, and the
 * thread gave no sign of it.
 */
const CUSTOMER = 'c0000000-0000-4000-8000-000000000001'
const VENDOR_USER = 'v0000000-0000-4000-8000-000000000002'
const ADMIN = 'a0000000-0000-4000-8000-000000000003'

const base = {
  currentUserId: VENDOR_USER,
  customerId: CUSTOMER,
  counterpartyName: 'Priya Sharma',
}

describe('senderLabel', () => {
  it('calls your own messages "You"', () => {
    expect(senderLabel({ ...base, senderUserId: VENDOR_USER, senderName: 'Anything' })).toBe('You')
  })

  it('uses the counterparty name for the customer when they have no profile name', () => {
    expect(senderLabel({ ...base, senderUserId: CUSTOMER, senderName: null })).toBe('Priya Sharma')
  })

  it('prefers the customer’s own name when they have one', () => {
    expect(senderLabel({ ...base, senderUserId: CUSTOMER, senderName: 'Priya S.' })).toBe(
      'Priya S.',
    )
  })

  // The bug. An unnamed third party must never inherit the customer's identity.
  it('never labels a third party as the counterparty', () => {
    expect(senderLabel({ ...base, senderUserId: ADMIN, senderName: null })).toBe(
      'Another participant',
    )
    expect(senderLabel({ ...base, senderUserId: ADMIN, senderName: null })).not.toBe('Priya Sharma')
  })

  it('names a third party when they have a name', () => {
    expect(senderLabel({ ...base, senderUserId: ADMIN, senderName: 'Support Team' })).toBe(
      'Support Team',
    )
  })

  // Without customerId we cannot prove anyone is the counterparty, so we must
  // not claim it — this is the state every caller was in before the fix.
  it('claims nothing when the customer is unknown', () => {
    expect(
      senderLabel({ ...base, customerId: undefined, senderUserId: CUSTOMER, senderName: null }),
    ).toBe('Another participant')
  })
})
