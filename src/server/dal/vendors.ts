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

/**
 * One answered attribute, ready to render. `value` is whatever the vendor
 * stored: a number, a boolean, a string, or an array of strings.
 */
export interface PublicVendorAttribute {
  id: string
  code: string
  label: string
  inputType: string
  unit: string | null
  sortOrder: number
  value: unknown
}

/** Blank, unanswered, or empty. An explicit `false` or `0` is an answer. */
function isUnanswered(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

interface AttributeValueRow {
  value_json: unknown
  category_attributes: {
    id: string
    code: string
    label: string
    input_type: string
    unit: string | null
    sort_order: number
  } | null
}

/**
 * Which answers reach the public page, and in what order.
 *
 * Exported because it is the whole rule: an unanswered attribute is absent, an
 * explicit "no" is not, and money is left to Packages — "1200 INR" in a
 * facilities grid is ugly and ambiguous about the unit. PostgREST cannot order
 * parent rows by an embedded column, so the sort happens here too.
 */
export function selectPublicAttributes(rows: AttributeValueRow[]): PublicVendorAttribute[] {
  return rows
    .flatMap((row) => {
      const definition = row.category_attributes
      if (!definition) return []
      if (definition.unit === 'INR') return []
      if (isUnanswered(row.value_json)) return []

      return [
        {
          id: definition.id,
          code: definition.code,
          label: definition.label,
          inputType: definition.input_type,
          unit: definition.unit,
          sortOrder: definition.sort_order,
          value: row.value_json,
        } satisfies PublicVendorAttribute,
      ]
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
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

    /*
     * Postgres reports every view column as nullable, so the generated types
     * widen them. Narrow once here, at the boundary, rather than making each
     * consumer cope: these three are NOT NULL on `vendors` and the view does
     * not outer-join them, so a null means the view definition changed and the
     * page should 404 rather than render half a profile.
     */
    const { id, slug: vendorSlug, display_name } = vendor
    if (!id || !vendorSlug || !display_name) {
      logError('dal.getPublicVendor', new Error('public_vendors returned null identity columns'), {
        slug,
      })
      return null
    }

    const [city, categories, media, packages, serviceAreas, attributes] = await Promise.all([
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
        .eq('vendor_id', id)
        .then((result) => result.data ?? []),
      supabase
        .from('vendor_media')
        .select('id, storage_path, alt_text, is_cover, width, height')
        .eq('vendor_id', id)
        .eq('moderation_status', 'approved')
        .order('is_cover', { ascending: false })
        .order('sort_order')
        .then((result) => (result.data ?? []) as PublicVendorMedia[]),
      supabase
        .from('vendor_packages')
        .select(
          'id, name, description, price_type, min_amount_minor, max_amount_minor, currency, unit, inclusions_json, exclusions_json',
        )
        .eq('vendor_id', id)
        .eq('active', true)
        .order('sort_order')
        .then((result) => (result.data ?? []) as unknown as PublicVendorPackage[]),
      supabase
        .from('vendor_service_areas')
        .select('travel_available, cities(id, name, slug)')
        .eq('vendor_id', id)
        .then((result) => result.data ?? []),
      // The vendor's answers to their categories' attributes (PRD 6.2) — the
      // same rows the search filters match against, shown as facilities.
      supabase
        .from('vendor_attribute_values')
        .select('value_json, category_attributes(id, code, label, input_type, unit, sort_order)')
        .eq('vendor_id', id)
        .then((result) => selectPublicAttributes(result.data ?? [])),
    ])

    return {
      ...vendor,
      id,
      slug: vendorSlug,
      display_name,
      ratingAverage: Number(vendor.rating_average ?? 0),
      ratingCount: Number(vendor.rating_count ?? 0),
      city,
      categories,
      media,
      packages,
      serviceAreas,
      attributes,
    }
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
        /*
         * `profiles` must be hinted with the constraint name: `reviews` has two
         * FKs to it (customer_id and reviewer_id), and an unhinted embed is
         * ambiguous. It must resolve to the customer — reviewer_id is the
         * moderating admin and must never surface publicly.
         *
         * `review_responses` is one-to-one (unique review_id), so it comes back
         * as a single object rather than an array.
         */
        .select(
          'id, overall_rating, title, body, event_date, created_at, profiles!reviews_customer_id_fkey(full_name), review_responses(body, created_at, status)',
        )
        .eq('vendor_id', vendorId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return (data ?? []).map((row) => {
        const response = row.review_responses
        const approved = response && response.status === 'approved' ? response : null

        return {
          id: row.id,
          overall_rating: row.overall_rating,
          title: row.title,
          body: row.body,
          event_date: row.event_date,
          created_at: row.created_at,
          customer_name: row.profiles?.full_name ?? null,
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
