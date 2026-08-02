import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ServiceError } from '@/lib/action-result'
import { type Actor } from '@/lib/permissions'
import { paymentAdapter, type ProviderEvent } from '@/lib/payments/adapter'
import { log, logError } from '@/lib/observability/logger'

/**
 * Billing services (PRD 6.10, 15).
 *
 * Webhooks are authoritative for online payment state, so everything that
 * grants entitlement flows through `applyProviderEvent`. Vendor-facing actions
 * only ever *ask* — they never write a subscription, because a client-driven
 * upgrade path is a client-driven free upgrade.
 */

export async function startCheckout(actor: Actor, vendorId: string, planCode: string) {
  if (!actor.userId) throw new ServiceError('unauthenticated', 'Please sign in.')

  const supabase = await createClient()
  const { data: plan } = await supabase
    .from('plans')
    .select('id, code, amount_minor, currency, active')
    .eq('code', planCode)
    .maybeSingle()

  if (!plan || !plan.active) throw new ServiceError('not_found', 'That plan is not available.')

  const session = await paymentAdapter().createCheckout({
    vendorId,
    planCode: plan.code,
    amountMinor: plan.amount_minor,
    currency: plan.currency,
  })

  return { url: session.url, providerSessionId: session.providerSessionId }
}

export interface WebhookOutcome {
  status: 'processed' | 'duplicate' | 'ignored'
  eventId: string
}

/**
 * Idempotent by construction.
 *
 * `webhook_events` has `unique (provider, external_event_id)`, so the insert
 * *is* the idempotency check — a duplicate delivery loses the race at the
 * database rather than being filtered by a read-then-write that two concurrent
 * deliveries could both pass.
 *
 * Uses the service-role client: a webhook has no session, and this is one of
 * the three places CLAUDE.md permits it.
 */
export async function applyProviderEvent(event: ProviderEvent): Promise<WebhookOutcome> {
  const supabase = createAdminClient()
  const provider = paymentAdapter().name

  if (!event.id) throw new ServiceError('validation_error', 'Event has no id.')

  const { error: claimError } = await supabase.from('webhook_events').insert({
    provider,
    external_event_id: event.id,
    type: event.type,
    status: 'received',
  })

  if (claimError) {
    if (claimError.code !== '23505') {
      throw new ServiceError('internal_error', 'Could not record the event.')
    }

    /*
     * The id is already claimed — but that alone does not mean it was handled.
     * Reporting every claimed id as a duplicate meant a first delivery that
     * failed was answered with 200 on every retry, so the event was lost
     * permanently. Found by driving the endpoint: the first call 500'd on the
     * upsert, and the retry came back "duplicate".
     *
     * Only a terminal outcome short-circuits. Anything else is reprocessed,
     * which is safe because every write below is an upsert or tolerates 23505.
     */
    const { data: existing } = await supabase
      .from('webhook_events')
      .select('status, attempts')
      .eq('provider', provider)
      .eq('external_event_id', event.id)
      .maybeSingle()

    if (existing && (existing.status === 'processed' || existing.status === 'ignored')) {
      log.info('billing.webhookDuplicate', { provider, eventId: event.id })
      return { status: 'duplicate', eventId: event.id }
    }

    await supabase
      .from('webhook_events')
      .update({ attempts: (existing?.attempts ?? 0) + 1, status: 'received' })
      .eq('provider', provider)
      .eq('external_event_id', event.id)

    log.info('billing.webhookRetry', {
      provider,
      eventId: event.id,
      previousStatus: existing?.status ?? 'unknown',
    })
  }

  try {
    const handled = await route(supabase, event)
    await supabase
      .from('webhook_events')
      .update({ status: handled ? 'processed' : 'ignored', processed_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('external_event_id', event.id)

    return { status: handled ? 'processed' : 'ignored', eventId: event.id }
  } catch (error) {
    logError('billing.applyProviderEvent', error, { eventId: event.id, type: event.type })
    // Recorded as failed rather than deleted, so the row still blocks a retry
    // storm while leaving the failure visible to an operator.
    await supabase
      .from('webhook_events')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'unknown',
      })
      .eq('provider', provider)
      .eq('external_event_id', event.id)
    throw error
  }
}

type AdminClient = ReturnType<typeof createAdminClient>

async function route(supabase: AdminClient, event: ProviderEvent): Promise<boolean> {
  switch (event.type) {
    case 'subscription.created':
    case 'subscription.updated':
      return upsertSubscription(supabase, event)
    case 'subscription.cancelled':
      return cancelSubscription(supabase, event)
    case 'payment.succeeded':
      return recordPayment(supabase, event, 'succeeded')
    case 'payment.failed':
      return recordPayment(supabase, event, 'failed')
    default:
      // An unknown event type is recorded and ignored, never an error: a
      // provider adding a new event must not turn into a retry loop.
      return false
  }
}

async function upsertSubscription(supabase: AdminClient, event: ProviderEvent): Promise<boolean> {
  if (!event.vendorId || !event.planCode) return false

  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('code', event.planCode)
    .maybeSingle()

  if (!plan) return false

  const { error } = await supabase.from('subscriptions').upsert(
    {
      vendor_id: event.vendorId,
      plan_id: plan.id,
      provider: paymentAdapter().name,
      provider_subscription_id: event.providerSubscriptionId,
      status: event.subscriptionStatus ?? 'active',
      period_start: event.occurredAt,
    },
    { onConflict: 'provider,provider_subscription_id' },
  )

  if (error) throw new ServiceError('internal_error', error.message)

  // The vendor's `plan_id` mirrors the subscription for cheap reads. The
  // subscription remains the source of truth; this is a cache, and the
  // entitlement functions in SQL read the subscription, not this column.
  await supabase.from('vendors').update({ plan_id: plan.id }).eq('id', event.vendorId)
  return true
}

async function cancelSubscription(supabase: AdminClient, event: ProviderEvent): Promise<boolean> {
  if (!event.providerSubscriptionId) return false

  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('provider_subscription_id', event.providerSubscriptionId)
    .select('vendor_id')

  if (error) throw new ServiceError('internal_error', error.message)
  if (!data || data.length === 0) return false

  /*
   * Losing the plan must also lose the placement it paid for. Without this the
   * vendor keeps "Sponsored" until someone notices — the guard in `0022` only
   * blocks *setting* the flag, it cannot retract one already set.
   *
   * PRD 6.10: expiry limits features; it never deletes vendor data.
   */
  for (const row of data) {
    if (!(await vendorStillEntitledToFeature(supabase, row.vendor_id))) {
      await supabase.from('vendors').update({ is_featured: false }).eq('id', row.vendor_id)
    }
  }
  return true
}

async function vendorStillEntitledToFeature(
  supabase: AdminClient,
  vendorId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc('vendor_may_be_featured', { p_vendor_id: vendorId })
  return Boolean(data)
}

async function recordPayment(
  supabase: AdminClient,
  event: ProviderEvent,
  status: 'succeeded' | 'failed',
): Promise<boolean> {
  if (!event.vendorId) return false

  const { error } = await supabase.from('payments').insert({
    vendor_id: event.vendorId,
    provider: paymentAdapter().name,
    provider_payment_id: event.providerPaymentId,
    amount_minor: event.amountMinor ?? 0,
    currency: event.currency,
    status,
    paid_at: status === 'succeeded' ? event.occurredAt : null,
  })

  // A duplicate payment id is not a failure — it is the provider retrying.
  if (error && error.code !== '23505') throw new ServiceError('internal_error', error.message)
  return true
}
