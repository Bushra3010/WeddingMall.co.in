import { NextResponse, type NextRequest } from 'next/server'

import { SignatureError, paymentAdapter } from '@/lib/payments/adapter'
import { applyProviderEvent } from '@/server/services/billing'
import { log, logError } from '@/lib/observability/logger'

/**
 * Payment provider webhook (PRD 6.10, 15).
 *
 * Two rules the PRD states outright, both load-bearing:
 *
 *   * **Signature-verified.** The raw body is read as text and verified before
 *     anything is parsed as meaningful. Parsing first would mean acting on
 *     attacker-controlled shape before establishing the sender.
 *   * **Idempotent.** Providers retry. `applyProviderEvent` claims the event
 *     id with a unique insert, so a duplicate loses at the database rather
 *     than in application logic two concurrent deliveries could both pass.
 *
 * Always returns 200 for a duplicate: a provider that receives an error for an
 * event we have already handled will simply send it again.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Must be the exact bytes that were signed — `request.json()` would discard
  // the whitespace the HMAC was computed over.
  const rawBody = await request.text()
  const signature = request.headers.get('x-signature') ?? request.headers.get('x-webhook-signature')

  let event
  try {
    event = paymentAdapter().verifyAndParse(rawBody, signature)
  } catch (error) {
    if (error instanceof SignatureError) {
      // 401 with no detail. An unsigned caller learns only that it was refused.
      log.warn('billing.webhookRejected', { reason: 'signature' })
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
    }
    log.warn('billing.webhookRejected', { reason: 'unparseable' })
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  try {
    const outcome = await applyProviderEvent(event)
    return NextResponse.json({ ok: true, ...outcome })
  } catch (error) {
    logError('billing.webhook', error, { eventId: event.id, type: event.type })
    // 500 so the provider retries; the event row is marked failed and remains
    // visible to an operator either way.
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
