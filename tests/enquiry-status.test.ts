import { describe, expect, it } from 'vitest'

import {
  allowedTransitions,
  checkTransition,
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_LABELS,
  QUALIFIED_STATUSES,
} from '@/features/enquiries/status'

describe('enquiry transition map', () => {
  it('labels every status', () => {
    for (const status of ENQUIRY_STATUSES) {
      expect(ENQUIRY_STATUS_LABELS[status]).toBeTruthy()
    }
  })

  it('follows the happy path', () => {
    expect(checkTransition('draft', 'submitted', 'customer').allowed).toBe(true)
    expect(checkTransition('submitted', 'delivered', 'system').allowed).toBe(true)
    expect(checkTransition('delivered', 'viewed', 'vendor').allowed).toBe(true)
    expect(checkTransition('viewed', 'qualified', 'vendor').allowed).toBe(true)
    expect(checkTransition('qualified', 'quote_sent', 'vendor').allowed).toBe(true)
    expect(checkTransition('quote_sent', 'booked', 'vendor').allowed).toBe(true)
  })

  it('rejects a skipped step', () => {
    expect(checkTransition('draft', 'booked', 'customer').allowed).toBe(false)
    expect(checkTransition('submitted', 'quote_sent', 'vendor').allowed).toBe(false)
  })

  it('rejects a no-op', () => {
    expect(checkTransition('delivered', 'delivered', 'vendor').allowed).toBe(false)
  })

  it('stops a customer marking their own enquiry qualified', () => {
    const result = checkTransition('viewed', 'qualified', 'customer')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('customer')
  })

  it('stops a vendor moving a lead straight to delivered', () => {
    expect(checkTransition('submitted', 'delivered', 'vendor').allowed).toBe(false)
  })

  it('requires a reason for destructive and admin-forced transitions', () => {
    expect(checkTransition('viewed', 'spam', 'vendor').requiresReason).toBe(true)
    expect(checkTransition('qualified', 'not_booked', 'vendor').requiresReason).toBe(true)
    expect(checkTransition('closed', 'negotiating', 'admin').requiresReason).toBe(true)
    expect(checkTransition('spam', 'delivered', 'admin').requiresReason).toBe(true)
  })

  it('does not require a reason on the happy path', () => {
    expect(checkTransition('delivered', 'viewed', 'vendor').requiresReason).toBe(false)
    expect(checkTransition('quote_sent', 'booked', 'vendor').requiresReason).toBe(false)
  })

  it('only lets an admin reopen a closed enquiry', () => {
    expect(allowedTransitions('closed', 'customer')).toEqual([])
    expect(allowedTransitions('closed', 'vendor')).toEqual([])
    expect(allowedTransitions('closed', 'admin')).toContain('negotiating')
  })

  it('counts the north-star statuses', () => {
    expect(QUALIFIED_STATUSES).toEqual(['qualified', 'quote_sent', 'negotiating', 'booked'])
    expect(QUALIFIED_STATUSES).not.toContain('spam')
    expect(QUALIFIED_STATUSES).not.toContain('delivered')
  })

  it('never lists a transition the check would reject', () => {
    for (const from of ENQUIRY_STATUSES) {
      for (const actor of ['customer', 'vendor', 'admin', 'system'] as const) {
        for (const to of allowedTransitions(from, actor)) {
          expect(checkTransition(from, to, actor).allowed).toBe(true)
        }
      }
    }
  })
})
