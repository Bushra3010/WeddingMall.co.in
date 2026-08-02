import { createHmac } from 'node:crypto'

import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Payment webhook contract (PRD 6.10, 15).
 *
 * Lives in E2E rather than unit tests because the two properties that matter —
 * signature verification and idempotency — are properties of the *route*
 * handling a real HTTP request, not of a function. A unit test calling the
 * service directly would skip the raw-body handling that signature
 * verification depends on.
 *
 * Skips rather than fails when the environment is not configured, so a
 * checkout without Supabase credentials does not report a false problem.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY
const SECRET = process.env.PAYMENT_WEBHOOK_SECRET

const configured = Boolean(SUPABASE_URL && SERVICE_KEY && SECRET)

test.skip(!configured, 'Supabase and PAYMENT_WEBHOOK_SECRET are required')

const sign = (body: string) => createHmac('sha256', SECRET!).update(body).digest('hex')

async function db(request: APIRequestContext, path: string, init: Record<string, unknown> = {}) {
  const response = await request.fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    ...init,
  })
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

test('rejects an unsigned, wrongly signed, or tampered payload', async ({ request }) => {
  const body = JSON.stringify({ id: `evt_${Date.now()}`, type: 'payment.succeeded', data: {} })
  const valid = sign(body)

  const unsigned = await request.post('/api/webhooks/payments', {
    headers: { 'Content-Type': 'application/json' },
    data: body,
  })
  expect(unsigned.status()).toBe(401)

  const wrong = await request.post('/api/webhooks/payments', {
    headers: { 'Content-Type': 'application/json', 'x-signature': 'a'.repeat(64) },
    data: body,
  })
  expect(wrong.status()).toBe(401)

  // The signature is valid for the original bytes, so changing one character
  // must invalidate it — this is the assertion that proves the HMAC covers the
  // body rather than just being present.
  const tampered = await request.post('/api/webhooks/payments', {
    headers: { 'Content-Type': 'application/json', 'x-signature': valid },
    data: body.replace('payment.succeeded', 'subscription.created'),
  })
  expect(tampered.status()).toBe(401)
})

test('an unknown event type is recorded and ignored, never retried', async ({ request }) => {
  const id = `evt_unknown_${Date.now()}`
  const body = JSON.stringify({ id, type: 'invoice.unheard_of', data: {} })

  const response = await request.post('/api/webhooks/payments', {
    headers: { 'Content-Type': 'application/json', 'x-signature': sign(body) },
    data: body,
  })

  expect(response.status()).toBe(200)
  expect((await response.json()).status).toBe('ignored')

  await db(request, `webhook_events?external_event_id=eq.${id}`, { method: 'DELETE' })
})

test('subscription lifecycle grants then retracts featured placement', async ({ request }) => {
  const vendors = await db(request, 'vendors?select=id,is_featured&status=eq.active&limit=1')
  const vendor = vendors[0]
  const restore = vendor.is_featured

  const subscriptionId = `sub_${Date.now()}`
  const created = `evt_created_${Date.now()}`
  const cancelled = `evt_cancelled_${Date.now()}`

  const send = async (body: string) => {
    const response = await request.post('/api/webhooks/payments', {
      headers: { 'Content-Type': 'application/json', 'x-signature': sign(body) },
      data: body,
    })
    return { status: response.status(), body: await response.json() }
  }

  const createBody = JSON.stringify({
    id: created,
    type: 'subscription.created',
    occurred_at: new Date().toISOString(),
    data: {
      vendor_id: vendor.id,
      plan_code: 'premium',
      subscription_id: subscriptionId,
      status: 'active',
    },
  })

  const first = await send(createBody)
  expect(first.body.status).toBe('processed')

  // Replaying a *processed* event must short-circuit. A first delivery that
  // failed must not — that distinction is why this asserts on a known-good
  // event rather than on "any second call returns duplicate".
  const replay = await send(createBody)
  expect(replay.body.status).toBe('duplicate')

  const subs = await db(
    request,
    `subscriptions?select=status,plans(code)&vendor_id=eq.${vendor.id}`,
  )
  expect(subs).toHaveLength(1)
  expect(subs[0].plans.code).toBe('premium')

  const featured = await db(request, `vendors?id=eq.${vendor.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: JSON.stringify({ is_featured: true }),
  })
  expect(featured[0].is_featured).toBe(true)

  const cancelResult = await send(
    JSON.stringify({
      id: cancelled,
      type: 'subscription.cancelled',
      occurred_at: new Date().toISOString(),
      data: { subscription_id: subscriptionId, status: 'cancelled' },
    }),
  )
  expect(cancelResult.body.status).toBe('processed')

  // Losing the plan has to lose the placement it paid for. The SQL guard only
  // blocks *setting* the flag; retracting one already set is the service's job.
  const after = await db(request, `vendors?select=is_featured&id=eq.${vendor.id}`)
  expect(after[0].is_featured).toBe(false)

  await db(request, `subscriptions?vendor_id=eq.${vendor.id}`, { method: 'DELETE' })
  await db(request, `webhook_events?external_event_id=in.(${created},${cancelled})`, {
    method: 'DELETE',
  })
  await db(request, `vendors?id=eq.${vendor.id}`, {
    method: 'PATCH',
    data: JSON.stringify({ plan_id: null, is_featured: restore }),
  })
})
