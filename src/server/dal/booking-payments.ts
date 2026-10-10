import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'

/**
 * Advance payments on a booking (migration 0044), read under RLS: the customer
 * sees their own, the vendor's members see theirs, admins see all.
 *
 * `booking_payments` enters the generated types on the next `npm run
 * db:types`; until then the client is used untyped here and the rows are
 * narrowed by hand. Delete the cast once the types are regenerated.
 */
export interface AdvancePayment {
  id: string
  amountMinor: number
  currency: string
  status: 'created' | 'paid' | 'failed'
  createdAt: string
  paidAt: string | null
}

export async function getAdvancePayments(enquiryId: string): Promise<AdvancePayment[]> {
  try {
    const supabase = (await createClient()) as unknown as SupabaseClient
    const { data, error } = await supabase
      .from('booking_payments')
      .select('id, amount_minor, currency, status, created_at, paid_at')
      .eq('enquiry_id', enquiryId)
      .order('created_at', { ascending: false })
    if (error) throw error

    return (data ?? []).map((row) => ({
      id: String(row.id),
      amountMinor: Number(row.amount_minor),
      currency: String(row.currency),
      status: row.status as AdvancePayment['status'],
      createdAt: String(row.created_at),
      paidAt: row.paid_at ? String(row.paid_at) : null,
    }))
  } catch (error) {
    // Before migration 0044 is applied the table does not exist; the page
    // must still render, just without the payment block's history.
    logError('dal.getAdvancePayments', error, { enquiryId })
    return []
  }
}
