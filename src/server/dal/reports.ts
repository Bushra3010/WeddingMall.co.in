import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'

/**
 * Marketplace KPIs (PRD 13).
 *
 * Lives in the DAL rather than the page for the usual reason — reads belong
 * here — and for one specific one: `Date.now()` is impure, and calling it in a
 * component body is exactly what the React Compiler's purity rule exists to
 * catch. A render that is not a pure function of its inputs cannot be safely
 * re-run, which the compiler assumes it may.
 */
export interface MarketplaceReport {
  vendors: number
  published: number
  approvedReviews: number
  pendingReviews: number
  enquiries30d: number
  delivered: number
  answered: number
  booked: number
  revenueMinor: number
  currency: string
  successfulPayments: number
  activeSubscriptions: number
}

export async function getMarketplaceReport(): Promise<MarketplaceReport> {
  const empty: MarketplaceReport = {
    vendors: 0,
    published: 0,
    approvedReviews: 0,
    pendingReviews: 0,
    enquiries30d: 0,
    delivered: 0,
    answered: 0,
    booked: 0,
    revenueMinor: 0,
    currency: 'INR',
    successfulPayments: 0,
    activeSubscriptions: 0,
  }

  try {
    const supabase = await createClient()
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()

    const [
      vendors,
      published,
      enquiries30d,
      delivered,
      answered,
      booked,
      approvedReviews,
      pendingReviews,
      payments,
      subs,
    ] = await Promise.all([
      supabase.from('vendors').select('id', { count: 'exact', head: true }),
      supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since),
      supabase
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .not('delivered_at', 'is', null),
      supabase
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .not('first_response_at', 'is', null),
      supabase
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'booked'),
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('payments').select('amount_minor, currency, status'),
      supabase.from('subscriptions').select('status'),
    ])

    const succeeded = (payments.data ?? []).filter((row) => row.status === 'succeeded')

    return {
      vendors: vendors.count ?? 0,
      published: published.count ?? 0,
      approvedReviews: approvedReviews.count ?? 0,
      pendingReviews: pendingReviews.count ?? 0,
      enquiries30d: enquiries30d.count ?? 0,
      delivered: delivered.count ?? 0,
      answered: answered.count ?? 0,
      booked: booked.count ?? 0,
      revenueMinor: succeeded.reduce((sum, row) => sum + Number(row.amount_minor ?? 0), 0),
      currency: succeeded[0]?.currency ?? 'INR',
      successfulPayments: succeeded.length,
      activeSubscriptions: (subs.data ?? []).filter((row) =>
        ['trialing', 'active', 'past_due'].includes(row.status),
      ).length,
    }
  } catch (error) {
    logError('dal.getMarketplaceReport', error)
    return empty
  }
}
