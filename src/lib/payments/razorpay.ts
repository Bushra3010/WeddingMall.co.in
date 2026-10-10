import 'server-only'

import { createHmac } from 'node:crypto'

import { serverEnv } from '@/lib/env'
import { safeEqual } from '@/lib/payments/adapter'

/**
 * Razorpay, for the optional booking advance (migration 0044).
 *
 * Deliberately small: create an order, and verify a webhook. The order is the
 * only thing the browser needs to open Checkout; whether the money arrived is
 * decided by the signed webhook alone, never by what the browser reports.
 */

export function razorpayConfigured(): boolean {
  const env = serverEnv()
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)
}

export function razorpayKeyId(): string {
  const id = serverEnv().RAZORPAY_KEY_ID
  if (!id) throw new Error('RAZORPAY_KEY_ID is not set')
  return id
}

export async function createRazorpayOrder(input: {
  amountMinor: number
  currency: string
  receipt: string
  notes: Record<string, string>
}): Promise<{ id: string; amount: number; currency: string }> {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = serverEnv()
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) throw new Error('Razorpay is not configured')

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    // The provider's body may name our account; it goes to the log, not the user.
    throw new Error(`Razorpay order failed with HTTP ${response.status}`)
  }
  const order = (await response.json()) as { id?: string; amount?: number; currency?: string }
  if (!order.id) throw new Error('Razorpay order response had no id')
  return {
    id: order.id,
    amount: order.amount ?? input.amountMinor,
    currency: order.currency ?? input.currency,
  }
}

/** `X-Razorpay-Signature` is hex HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyRazorpayWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqual(expected, signature)
}
