import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { advanceSchema, capturedPaymentFrom, offersAdvance } from '@/features/payments/advance'
import { verifyRazorpayWebhook } from '@/lib/payments/razorpay'

const ENQUIRY = '7b0c8f0e-1f1a-4c1e-9a55-0d5d3c1b2a01'

function captured(overrides: Record<string, unknown> = {}, event = 'payment.captured') {
  return {
    event,
    payload: {
      payment: {
        entity: {
          id: 'pay_123',
          order_id: 'order_456',
          amount: 100000,
          currency: 'INR',
          status: 'captured',
          ...overrides,
        },
      },
    },
  }
}

describe('offersAdvance', () => {
  it('is offered for cars only', () => {
    expect(offersAdvance('car')).toBe(true)
    expect(offersAdvance('venues')).toBe(false)
    expect(offersAdvance(null)).toBe(false)
  })
})

describe('advanceSchema', () => {
  it('takes whole rupees within the limits', () => {
    expect(advanceSchema.safeParse({ enquiryId: ENQUIRY, amountRupees: '1000' }).success).toBe(true)
    for (const amountRupees of ['0', '-5', '10.5', '100001', '']) {
      expect(
        advanceSchema.safeParse({ enquiryId: ENQUIRY, amountRupees }).success,
        amountRupees,
      ).toBe(false)
    }
  })
})

describe('capturedPaymentFrom', () => {
  it('reads a captured payment from either event', () => {
    const expected = {
      paymentId: 'pay_123',
      orderId: 'order_456',
      amountMinor: 100000,
      currency: 'INR',
    }
    expect(capturedPaymentFrom(captured())).toEqual(expected)
    expect(capturedPaymentFrom(captured({}, 'order.paid'))).toEqual(expected)
  })

  it('ignores anything that is not a captured payment', () => {
    expect(capturedPaymentFrom(captured({}, 'payment.failed'))).toBeNull()
    expect(capturedPaymentFrom(captured({ status: 'authorized' }))).toBeNull()
    expect(capturedPaymentFrom(captured({ amount: '100000' }))).toBeNull()
    expect(capturedPaymentFrom(null)).toBeNull()
  })
})

describe('verifyRazorpayWebhook', () => {
  const secret = 'whsec_test'
  const body = JSON.stringify(captured())
  const good = createHmac('sha256', secret).update(body).digest('hex')

  it('accepts the signature Razorpay computes', () => {
    expect(verifyRazorpayWebhook(body, good, secret)).toBe(true)
  })

  it('refuses a missing, wrong or re-used signature', () => {
    expect(verifyRazorpayWebhook(body, null, secret)).toBe(false)
    expect(verifyRazorpayWebhook(body, good, 'other-secret')).toBe(false)
    expect(verifyRazorpayWebhook(`${body} `, good, secret)).toBe(false)
  })
})
