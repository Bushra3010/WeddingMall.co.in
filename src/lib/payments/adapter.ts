import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { serverEnv } from '@/lib/env'

/**
 * Payment provider adapter (PRD 6.10, 15).
 *
 * A mock provider until real credentials exist, behind the interface the real
 * one will implement. The point of the seam is that the webhook handler,
 * subscription service, and admin screens are written against *this*, so
 * swapping providers later touches one file rather than the whole billing
 * path.
 *
 * The mock still signs its payloads with the same HMAC scheme a real provider
 * uses. Testing signature verification against an unsigned mock would verify
 * nothing, and the day credentials arrive is a bad day to discover the
 * verification path was never exercised.
 */

export interface CheckoutSession {
  /** Where the vendor is sent to pay. */
  url: string
  providerSessionId: string
}

export interface ProviderEvent {
  id: string
  type: string
  vendorId: string | null
  planCode: string | null
  providerSubscriptionId: string | null
  providerPaymentId: string | null
  amountMinor: number | null
  currency: string
  /** Provider's own status string, already narrowed to ours by the adapter. */
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'cancelled' | null
  occurredAt: string
}

export interface PaymentAdapter {
  readonly name: string
  createCheckout(input: {
    vendorId: string
    planCode: string
    amountMinor: number
    currency: string
  }): Promise<CheckoutSession>
  /** Throws if the signature does not match. Returns the parsed event. */
  verifyAndParse(rawBody: string, signature: string | null): ProviderEvent
}

/** Constant-time compare that tolerates unequal lengths without throwing. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function signPayload(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex')
}

export class SignatureError extends Error {
  constructor() {
    // Deliberately uninformative: a caller probing the endpoint learns only
    // that it was rejected, never how close they were.
    super('Invalid signature')
    this.name = 'SignatureError'
  }
}

const mockAdapter: PaymentAdapter = {
  name: 'mock',

  async createCheckout({ vendorId, planCode }) {
    const providerSessionId = `mock_cs_${vendorId.slice(0, 8)}_${Date.now()}`
    // Points back at our own confirmation route rather than anywhere external,
    // so a developer can complete the flow without a provider account.
    return {
      providerSessionId,
      url: `/vendor-dashboard/plan/mock-checkout?session=${providerSessionId}&plan=${planCode}`,
    }
  },

  verifyAndParse(rawBody, signature) {
    const secret = serverEnv().PAYMENT_WEBHOOK_SECRET
    if (!secret) throw new SignatureError()
    if (!signature || !safeEqual(signature, signPayload(rawBody, secret))) {
      throw new SignatureError()
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>
    const data = (payload.data ?? {}) as Record<string, unknown>

    const statusMap: Record<string, ProviderEvent['subscriptionStatus']> = {
      trialing: 'trialing',
      active: 'active',
      past_due: 'past_due',
      cancelled: 'cancelled',
      canceled: 'cancelled',
    }

    return {
      id: String(payload.id ?? ''),
      type: String(payload.type ?? ''),
      vendorId: data.vendor_id ? String(data.vendor_id) : null,
      planCode: data.plan_code ? String(data.plan_code) : null,
      providerSubscriptionId: data.subscription_id ? String(data.subscription_id) : null,
      providerPaymentId: data.payment_id ? String(data.payment_id) : null,
      amountMinor: data.amount_minor === undefined ? null : Number(data.amount_minor),
      currency: String(data.currency ?? 'INR'),
      subscriptionStatus: statusMap[String(data.status ?? '')] ?? null,
      occurredAt: String(payload.occurred_at ?? new Date().toISOString()),
    }
  },
}

export function paymentAdapter(): PaymentAdapter {
  // Only one implementation today. The lookup exists so adding a real provider
  // is a new branch here rather than an edit everywhere it is used.
  return mockAdapter
}
