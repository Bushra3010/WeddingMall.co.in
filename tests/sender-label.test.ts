import { describe, expect, it } from 'vitest'

import { senderLabel } from '@/features/messaging/sender-label'

/**
 * Two requirements meet here.
 *
 * The security one: a third party must never be displayed as a party. That was
 * a real disclosure — an administrator's messages were shown to a vendor as
 * the customer's, and the thread gave no sign of it.
 *
 * The product one: both sides see real names. No "Customer", no "Vendor".
 */
const base = { customerName: 'Priya Sharma', vendorName: 'Blinksai' }

describe('senderLabel', () => {
  it('shows the vendor’s business name for anyone on the vendor side', () => {
    expect(senderLabel({ ...base, senderRole: 'vendor', senderName: 'Ravi (staff)' })).toBe(
      'Blinksai',
    )
    // Even with no profile name, the business is still named.
    expect(senderLabel({ ...base, senderRole: 'vendor', senderName: null })).toBe('Blinksai')
  })

  it('shows the customer’s own account name', () => {
    expect(senderLabel({ ...base, senderRole: 'customer', senderName: 'Priya S.' })).toBe(
      'Priya S.',
    )
    expect(senderLabel({ ...base, senderRole: 'customer', senderName: null })).toBe('Priya Sharma')
  })

  it('never returns a generic party label', () => {
    const results = [
      senderLabel({ ...base, senderRole: 'vendor', senderName: null }),
      senderLabel({ ...base, senderRole: 'customer', senderName: null }),
    ]
    for (const label of results) {
      expect(label).not.toBe('Customer')
      expect(label).not.toBe('Vendor')
      expect(label).not.toBe('the customer')
    }
  })

  // The disclosure. A non-party must not inherit either side's identity.
  it('never labels a third party as either party', () => {
    const label = senderLabel({ ...base, senderRole: 'other', senderName: null })
    expect(label).toBe('Not a participant')
    expect(label).not.toBe('Priya Sharma')
    expect(label).not.toBe('Blinksai')
  })

  it('names a third party when they have a name', () => {
    expect(senderLabel({ ...base, senderRole: 'other', senderName: 'Support Team' })).toBe(
      'Support Team',
    )
  })

  it('falls back only when the customer has set no name anywhere', () => {
    expect(
      senderLabel({ ...base, customerName: null, senderRole: 'customer', senderName: null }),
    ).toBe('This customer')
  })
})
