import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'

/**
 * Vendor analytics reads (PRD 6.9, 13).
 *
 * Everything here comes from `vendor_metrics_daily`, which migration `0019`
 * recomputes from operational tables. Nothing is estimated: a day with no
 * activity reads zero rather than being smoothed or omitted, because a vendor
 * deciding whether to pay for a plan needs the real shape of their traffic.
 */

export interface MetricsSummary {
  profileViews: number
  shortlistAdds: number
  enquiries: number
  messages: number
  bookedCount: number
  /** Share of delivered enquiries that got a first response, 0–1. */
  responseRate: number | null
  /** Median hours to first response, or null when nothing has been answered. */
  medianResponseHours: number | null
  overdueCount: number
  series: { date: string; enquiries: number; profileViews: number }[]
}

export async function getVendorMetrics(vendorId: string, days = 30): Promise<MetricsSummary> {
  const empty: MetricsSummary = {
    profileViews: 0,
    shortlistAdds: 0,
    enquiries: 0,
    messages: 0,
    bookedCount: 0,
    responseRate: null,
    medianResponseHours: null,
    overdueCount: 0,
    series: [],
  }

  try {
    const supabase = await createClient()
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

    const [{ data: rows, error }, { data: sla }] = await Promise.all([
      supabase
        .from('vendor_metrics_daily')
        .select('date, profile_views, shortlist_adds, enquiries, messages, booked_count')
        .eq('vendor_id', vendorId)
        .gte('date', since)
        .order('date'),
      supabase
        .from('enquiry_sla')
        .select('hours_to_first_response, first_response_at, delivered_at, is_overdue')
        .eq('vendor_id', vendorId),
    ])

    if (error) throw error

    const summary = (rows ?? []).reduce(
      (acc, row) => ({
        profileViews: acc.profileViews + (row.profile_views ?? 0),
        shortlistAdds: acc.shortlistAdds + (row.shortlist_adds ?? 0),
        enquiries: acc.enquiries + (row.enquiries ?? 0),
        messages: acc.messages + (row.messages ?? 0),
        bookedCount: acc.bookedCount + (row.booked_count ?? 0),
      }),
      { profileViews: 0, shortlistAdds: 0, enquiries: 0, messages: 0, bookedCount: 0 },
    )

    const delivered = (sla ?? []).filter((row) => row.delivered_at)
    const answered = delivered.filter((row) => row.first_response_at)

    // Median rather than mean: one enquiry answered three weeks late would drag
    // an average far away from the experience of a typical customer.
    const times = answered
      .map((row) => Number(row.hours_to_first_response ?? 0))
      .sort((a, b) => a - b)
    const median =
      times.length === 0
        ? null
        : times.length % 2 === 1
          ? times[(times.length - 1) / 2]
          : (times[times.length / 2 - 1] + times[times.length / 2]) / 2

    return {
      ...summary,
      // Null, not zero, when nothing has been delivered — "0% response rate"
      // would be an accusation rather than a measurement.
      responseRate: delivered.length === 0 ? null : answered.length / delivered.length,
      medianResponseHours: median,
      overdueCount: (sla ?? []).filter((row) => row.is_overdue).length,
      series: (rows ?? []).map((row) => ({
        date: row.date,
        enquiries: row.enquiries ?? 0,
        profileViews: row.profile_views ?? 0,
      })),
    }
  } catch (error) {
    logError('dal.getVendorMetrics', error, { vendorId })
    return empty
  }
}

export interface OverdueEnquiry {
  enquiryId: string
  deliveredAt: string
  hoursWaiting: number
}

/** Overdue leads, newest first, for the dashboard's "needs attention" list. */
export async function getOverdueEnquiries(vendorId: string): Promise<OverdueEnquiry[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('enquiry_sla')
      .select('enquiry_id, delivered_at, hours_to_first_response')
      .eq('vendor_id', vendorId)
      .eq('is_overdue', true)
      .order('delivered_at')

    if (error) throw error

    return (data ?? [])
      .filter((row) => row.delivered_at)
      .map((row) => ({
        enquiryId: row.enquiry_id!,
        deliveredAt: row.delivered_at!,
        hoursWaiting: Number(row.hours_to_first_response ?? 0),
      }))
  } catch (error) {
    logError('dal.getOverdueEnquiries', error, { vendorId })
    return []
  }
}
