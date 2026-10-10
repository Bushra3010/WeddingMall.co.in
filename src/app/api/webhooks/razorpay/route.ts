import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { capturedPaymentFrom } from '@/features/payments/advance'
import { serverEnv } from '@/lib/env'
import { log, logError } from '@/lib/observability/logger'
import { verifyRazorpayWebhook } from '@/lib/payments/razorpay'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Razorpay webhook for booking advances (migration 0044).
 *
 * The only place an advance becomes `paid`. The raw body is verified against
 * `RAZORPAY_WEBHOOK_SECRET` before it is parsed. The update matches on order
 * id *and* amount *and* currency, so a captured payment for a different sum
 * cannot settle an order, and it skips rows already paid — Razorpay retries,
 * and `payment.captured` and `order.paid` both arrive for one payment.
 *
 * Service-role client: webhooks are a permitted caller (CLAUDE.md invariant 1),
 * and no customer or vendor policy allows this update.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const secret = serverEnv().RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    log.warn('payments.razorpayWebhook', { reason: 'not configured' })
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const rawBody = await request.text()
  if (!verifyRazorpayWebhook(rawBody, request.headers.get('x-razorpay-signature'), secret)) {
    log.warn('payments.razorpayWebhook', { reason: 'signature' })
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const payment = capturedPaymentFrom(body)
  // Events we do not act on are acknowledged, or Razorpay keeps retrying them.
  if (!payment) return NextResponse.json({ ok: true, ignored: true })

  try {
    const admin = createAdminClient() as unknown as SupabaseClient
    const { error } = await admin
      .from('booking_payments')
      .update({
        status: 'paid',
        provider_payment_id: payment.paymentId,
        paid_at: new Date().toISOString(),
      })
      .eq('provider_order_id', payment.orderId)
      .eq('amount_minor', payment.amountMinor)
      .eq('currency', payment.currency)
      .neq('status', 'paid')
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    logError('payments.razorpayWebhook', error, { orderId: payment.orderId })
    // 500 so Razorpay retries.
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
