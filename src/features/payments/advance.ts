import { z } from 'zod'

/**
 * Optional online advance on a booking (migration 0044).
 *
 * Offered only in these categories. Wedding cars first; adding a slug here is
 * all it takes to offer it elsewhere.
 */
export const ADVANCE_CATEGORY_SLUGS: readonly string[] = ['car']

/** In rupees, as the customer types it. Razorpay's floor is ₹1; ours is ₹1 too. */
export const MIN_ADVANCE_RUPEES = 1
export const MAX_ADVANCE_RUPEES = 100000

export const advanceSchema = z.object({
  enquiryId: z.uuid(),
  amountRupees: z.coerce
    .number({ error: 'Enter an amount' })
    .int('Whole rupees only')
    .min(MIN_ADVANCE_RUPEES, `At least ₹${MIN_ADVANCE_RUPEES}`)
    .max(MAX_ADVANCE_RUPEES, `At most ₹${MAX_ADVANCE_RUPEES.toLocaleString('en-IN')}`),
})

export type AdvanceInput = z.infer<typeof advanceSchema>

export function offersAdvance(categorySlug: string | null | undefined): boolean {
  return Boolean(categorySlug && ADVANCE_CATEGORY_SLUGS.includes(categorySlug))
}

/** What the Razorpay webhook carries that we act on. */
export interface CapturedPayment {
  paymentId: string
  orderId: string
  amountMinor: number
  currency: string
}

/**
 * Narrow a Razorpay webhook body to a captured payment, or null for any event
 * we do not act on. Called only after the signature has been verified.
 */
export function capturedPaymentFrom(body: unknown): CapturedPayment | null {
  if (!body || typeof body !== 'object') return null
  const event = (body as { event?: unknown }).event
  if (event !== 'payment.captured' && event !== 'order.paid') return null

  const entity = (body as { payload?: { payment?: { entity?: Record<string, unknown> } } }).payload
    ?.payment?.entity
  if (!entity) return null

  const { id, order_id: orderId, amount, currency, status } = entity
  if (status !== 'captured') return null
  if (typeof id !== 'string' || typeof orderId !== 'string') return null
  if (typeof amount !== 'number' || typeof currency !== 'string') return null
  return { paymentId: id, orderId, amountMinor: amount, currency }
}
