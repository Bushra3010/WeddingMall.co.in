import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'

/**
 * Billing reads (PRD 6.10).
 *
 * Entitlements are read from the *subscription's* plan, never from
 * `vendors.plan_id`, which is only a cache the webhook keeps warm. The SQL
 * guard in `0022` reads the subscription too, so a screen and the database
 * cannot disagree about what a vendor is entitled to.
 */

export interface Entitlements {
  listings: number
  categories: number
  media: number
  teamSize: number
  leadQuota: number | null
  analytics: string
  featured: boolean
  export: boolean
}

const FALLBACK: Entitlements = {
  listings: 1,
  categories: 1,
  media: 10,
  teamSize: 1,
  leadQuota: 10,
  analytics: 'basic',
  featured: false,
  export: false,
}

export interface PlanRow {
  id: string
  code: string
  name: string
  amountMinor: number
  currency: string
  billingInterval: string
  entitlements: Entitlements
}

export interface SubscriptionRow {
  id: string
  status: string
  planCode: string
  planName: string
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
}

function parseEntitlements(raw: unknown): Entitlements {
  const value = (raw ?? {}) as Record<string, unknown>
  const num = (key: keyof Entitlements, fallback: number) =>
    typeof value[key] === 'number' ? (value[key] as number) : fallback

  return {
    listings: num('listings', FALLBACK.listings),
    categories: num('categories', FALLBACK.categories),
    media: num('media', FALLBACK.media),
    teamSize: num('teamSize', FALLBACK.teamSize),
    // `null` is meaningful here — it is "unlimited", not "missing".
    leadQuota: value.leadQuota === null ? null : num('leadQuota', FALLBACK.leadQuota ?? 10),
    analytics: typeof value.analytics === 'string' ? value.analytics : FALLBACK.analytics,
    featured: value.featured === true,
    export: value.export === true,
  }
}

export async function listPlans(): Promise<PlanRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('plans')
      .select('id, code, name, amount_minor, currency, billing_interval, entitlements_json')
      .eq('active', true)
      .order('sort_order')

    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      amountMinor: row.amount_minor,
      currency: row.currency,
      billingInterval: row.billing_interval,
      entitlements: parseEntitlements(row.entitlements_json),
    }))
  } catch (error) {
    logError('dal.listPlans', error)
    return []
  }
}

/** The vendor's live subscription, or null while they are on the free tier. */
export async function getSubscription(vendorId: string): Promise<SubscriptionRow | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, status, period_end, cancel_at_period_end, plans(code, name)')
      .eq('vendor_id', vendorId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      id: data.id,
      status: data.status,
      planCode: data.plans?.code ?? 'free',
      planName: data.plans?.name ?? 'Free',
      periodEnd: data.period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
    }
  } catch (error) {
    logError('dal.getSubscription', error, { vendorId })
    return null
  }
}

/**
 * What this vendor may actually do right now.
 *
 * Falls back to the free tier rather than throwing: a billing outage must
 * degrade a vendor to the base plan, never lock them out of their own
 * dashboard.
 */
export async function getEntitlements(vendorId: string): Promise<Entitlements> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('subscriptions')
      .select('plans(entitlements_json)')
      .eq('vendor_id', vendorId)
      .in('status', ['trialing', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.plans?.entitlements_json) return parseEntitlements(data.plans.entitlements_json)

    const { data: free } = await supabase
      .from('plans')
      .select('entitlements_json')
      .eq('code', 'free')
      .maybeSingle()

    return free ? parseEntitlements(free.entitlements_json) : FALLBACK
  } catch (error) {
    logError('dal.getEntitlements', error, { vendorId })
    return FALLBACK
  }
}

export interface PaymentRow {
  id: string
  amountMinor: number
  currency: string
  status: string
  paidAt: string | null
  createdAt: string
  vendorName?: string
}

export async function getVendorPayments(vendorId: string): Promise<PaymentRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount_minor, currency, status, paid_at, created_at')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      amountMinor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      paidAt: row.paid_at,
      createdAt: row.created_at,
    }))
  } catch (error) {
    logError('dal.getVendorPayments', error, { vendorId })
    return []
  }
}
