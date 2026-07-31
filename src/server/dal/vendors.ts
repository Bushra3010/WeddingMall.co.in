import 'server-only'

import { cache } from 'react'

import { createPublicClient } from '@/lib/supabase/public'
import { logError } from '@/lib/observability/logger'

/**
 * Public vendor reads. Every query here goes through `public_vendors` or a
 * table whose RLS restricts rows to approved/published content — the public
 * page never reads a draft (PRD 6.3).
 */

export interface PublicVendorPackage {
  id: string
  name: string
  description: string | null
  price_type: string
  min_amount_minor: number | null
  max_amount_minor: number | null
  currency: string
  unit: string | null
  inclusions_json: string[]
  exclusions_json: string[]
}

export interface PublicVendorMedia {
  id: string
  storage_path: string
  alt_text: string | null
  is_cover: boolean
  width: number | null
  height: number | null
}

export interface PublicVendorReview {
  id: string
  overall_rating: number
  title: string | null
  body: string | null
  event_date: string | null
  created_at: string
  customer_name: string | null
  response: { body: string; created_at: string } | null
}

export const getPublicVendor = cache(async (slug: string) => {
  try {
    const supabase = createPublicClient()

    const { data: vendor, error } = await supabase
      .from('public_vendors')
      .select(
        'id, display_name, slug, primary_city_id, website, founded_year, verification_status, rating_average, rating_count, about, experience_years, languages, policies_json, faqs_json',
      )
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw error
    if (!vendor) return null

    const [city, categories, media, packages, serviceAreas] = await Promise.all([
      vendor.primary_city_id
        ? supabase
            .from('cities')
            .select('id, name, slug')
            .eq('id', vendor.primary_city_id)
            .maybeSingle()
            .then((result) => result.data)
        : Promise.resolve(null),
      supabase
        .from('vendor_categories')
        .select('is_primary, categories(id, name, slug)')
        .eq('vendor_id', vendor.id)
        .then((result) => result.data ?? []),
      supabase
        .from('vendor_media')
        .select('id, storage_path, alt_text, is_cover, width, height')
        .eq('vendor_id', vendor.id)
        .eq('moderation_status', 'approved')
        .order('is_cover', { ascending: false })
        .order('sort_order')
        .then((result) => (result.data ?? []) as PublicVendorMedia[]),
      supabase
        .from('vendor_packages')
        .select(
          'id, name, description, price_type, min_amount_minor, max_amount_minor, currency, unit, inclusions_json, exclusions_json',
        )
        .eq('vendor_id', vendor.id)
        .eq('active', true)
        .order('sort_order')
        .then((result) => (result.data ?? []) as PublicVendorPackage[]),
      supabase
        .from('vendor_service_areas')
        .select('travel_available, cities(id, name, slug)')
        .eq('vendor_id', vendor.id)
        .then((result) => result.data ?? []),
    ])

    return { ...vendor, city, categories, media, packages, serviceAreas }
  } catch (error) {
    logError('dal.getPublicVendor', error, { slug })
    return null
  }
})

/** Approved reviews only — the rating summary must match what is visible. */
export const getVendorReviews = cache(
  async (vendorId: string, limit = 20): Promise<PublicVendorReview[]> => {
    try {
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .from('reviews')
        .select(
          'id, overall_rating, title, body, event_date, created_at, profiles(full_name), review_responses(body, created_at, status)',
        )
        .eq('vendor_id', vendorId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return (data ?? []).map((row) => {
        // Cast via `unknown`: embedded-relation types are unresolved until
        // `npm run db:types` runs against a real project.
        const profile = row.profiles as unknown as { full_name: string | null } | null
        const responses = (row.review_responses ?? []) as unknown as {
          body: string
          created_at: string
          status: string
        }[]
        const approved = responses.find((response) => response.status === 'approved')

        return {
          id: row.id as string,
          overall_rating: row.overall_rating as number,
          title: row.title as string | null,
          body: row.body as string | null,
          event_date: row.event_date as string | null,
          created_at: row.created_at as string,
          customer_name: profile?.full_name ?? null,
          response: approved ? { body: approved.body, created_at: approved.created_at } : null,
        }
      })
    } catch (error) {
      logError('dal.getVendorReviews', error, { vendorId })
      return []
    }
  },
)

/** Rating distribution for the histogram (PRD 6.3). */
export async function getRatingDistribution(vendorId: string): Promise<Record<number, number>> {
  const empty = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('reviews')
      .select('overall_rating')
      .eq('vendor_id', vendorId)
      .eq('status', 'approved')

    if (error) throw error

    return (data ?? []).reduce<Record<number, number>>((acc, row) => {
      const rating = row.overall_rating as number
      acc[rating] = (acc[rating] ?? 0) + 1
      return acc
    }, empty)
  } catch (error) {
    logError('dal.getRatingDistribution', error, { vendorId })
    return empty
  }
}
