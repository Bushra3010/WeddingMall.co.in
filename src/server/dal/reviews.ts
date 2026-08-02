import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'

/**
 * Review reads for the three private surfaces: the customer's own reviews, the
 * vendor's inbox, and the moderation queue (PRD 6.8, 6.11).
 *
 * The public read path lives in `dal/vendors.ts` and must stay there — it uses
 * the cookie-free client so vendor profiles remain cacheable (ADR-030).
 *
 * As in `dal/enquiries.ts`: `reviews: own read` also admits vendor members and
 * moderators, so a query meaning "reviews I wrote" filters on `customer_id`
 * rather than trusting the policy to mean that.
 */

export interface EligibleEnquiry {
  enquiryId: string
  vendorId: string
  vendorName: string
  vendorSlug: string
  status: string
  eventDate: string | null
}

/**
 * Enquiries this customer may still review.
 *
 * The eligible status list is read from the database rather than repeated
 * here, so widening it is a configuration change and this screen follows
 * automatically (migration `0018`).
 */
export async function getReviewableEnquiries(): Promise<EligibleEnquiry[]> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const [{ data: eligible }, { data: reviewed }] = await Promise.all([
      supabase.from('review_eligible_statuses').select('status'),
      supabase.from('reviews').select('enquiry_id').eq('customer_id', user.id),
    ])

    const statuses = (eligible ?? []).map((row) => row.status)
    if (statuses.length === 0) return []

    const already = new Set((reviewed ?? []).map((row) => row.enquiry_id))

    const { data, error } = await supabase
      .from('enquiries')
      .select('id, status, event_date, vendor_id, vendors(display_name, slug)')
      .eq('customer_id', user.id)
      .in('status', statuses)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? [])
      .filter((row) => !already.has(row.id) && row.vendors)
      .map((row) => ({
        enquiryId: row.id,
        vendorId: row.vendor_id,
        vendorName: row.vendors!.display_name,
        vendorSlug: row.vendors!.slug,
        status: row.status,
        eventDate: row.event_date,
      }))
  } catch (error) {
    logError('dal.getReviewableEnquiries', error)
    return []
  }
}

export interface OwnReview {
  id: string
  vendorName: string
  vendorSlug: string
  overallRating: number
  title: string | null
  body: string | null
  eventDate: string | null
  status: string
  moderationReason: string | null
  createdAt: string
  editedAt: string | null
  revisionCount: number
}

export async function getOwnReviews(): Promise<OwnReview[]> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('reviews')
      .select(
        'id, overall_rating, title, body, event_date, status, moderation_reason, created_at, edited_at, vendors(display_name, slug), review_revisions(id)',
      )
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      vendorName: row.vendors?.display_name ?? 'Vendor',
      vendorSlug: row.vendors?.slug ?? '',
      overallRating: row.overall_rating,
      title: row.title,
      body: row.body,
      eventDate: row.event_date,
      status: row.status,
      moderationReason: row.moderation_reason,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      revisionCount: (row.review_revisions ?? []).length,
    }))
  } catch (error) {
    logError('dal.getOwnReviews', error)
    return []
  }
}

export interface VendorReviewRow {
  id: string
  overallRating: number
  title: string | null
  body: string | null
  status: string
  createdAt: string
  customerName: string | null
  response: { id: string; body: string; status: string } | null
}

/** Reviews about this vendor, including ones still in moderation. */
export async function getVendorReviewInbox(vendorId: string): Promise<VendorReviewRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reviews')
      .select(
        // `profiles` needs the FK hint: `reviews` has two FKs to it, and the
        // reviewer is the moderating admin, who must not surface here.
        'id, overall_rating, title, body, status, created_at, profiles!reviews_customer_id_fkey(full_name), review_responses(id, body, status)',
      )
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      overallRating: row.overall_rating,
      title: row.title,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
      customerName: row.profiles?.full_name ?? null,
      response: row.review_responses
        ? {
            id: row.review_responses.id,
            body: row.review_responses.body,
            status: row.review_responses.status,
          }
        : null,
    }))
  } catch (error) {
    logError('dal.getVendorReviewInbox', error, { vendorId })
    return []
  }
}

export interface ModerationReview {
  id: string
  overallRating: number
  title: string | null
  body: string | null
  status: string
  createdAt: string
  editedAt: string | null
  vendorName: string
  customerName: string | null
  revisionCount: number
}

export async function getReviewModerationQueue(
  status: 'pending' | 'flagged' | 'approved' | 'rejected' = 'pending',
): Promise<ModerationReview[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reviews')
      .select(
        'id, overall_rating, title, body, status, created_at, edited_at, vendors(display_name), profiles!reviews_customer_id_fkey(full_name), review_revisions(id)',
      )
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      overallRating: row.overall_rating,
      title: row.title,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      vendorName: row.vendors?.display_name ?? 'Vendor',
      customerName: row.profiles?.full_name ?? null,
      revisionCount: (row.review_revisions ?? []).length,
    }))
  } catch (error) {
    logError('dal.getReviewModerationQueue', error, { status })
    return []
  }
}

export async function getReviewQueueCounts(): Promise<Record<string, number>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('reviews').select('status')
    if (error) throw error

    return (data ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    }, {})
  } catch (error) {
    logError('dal.getReviewQueueCounts', error)
    return {}
  }
}
