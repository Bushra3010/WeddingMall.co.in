import 'server-only'

import { createPublicClient } from '@/lib/supabase/public'
import { logError } from '@/lib/observability/logger'
import { searchFiltersSchema, type SearchFilters } from '@/features/search/filters'

/**
 * Adapter boundary for search (PRD 3, 11.3).
 *
 * Callers depend on this contract, not on `search_vendors`. Swapping in an
 * external engine later means reimplementing this function only.
 */

/** One numeric fact worth a chip on a card: "1,000 guests", "100 cars". */
export interface VendorHighlight {
  code: string
  value: number
  /** The attribute's unit where it has one, else its label. */
  noun: string
}

export interface VendorSearchResult {
  vendorId: string
  slug: string
  displayName: string
  citySlug: string | null
  cityName: string | null
  ratingAverage: number
  ratingCount: number
  verificationStatus: string
  isFeatured: boolean
  startingAmountMinor: number | null
  currency: string
  coverPath: string | null
  rankScore: number
  /** Approved photographs. 0 when the vendor has only the cover, or none. */
  photoCount: number
  /** At most two, see `enrichResults`. */
  highlights: VendorHighlight[]
}

/**
 * Which numeric attributes earn a chip, when a vendor has answered more than
 * two. A presentation hint like the icon map, not a contract: a code missing
 * from here is not excluded, it just queues behind these by the attribute's own
 * `sort_order`, which an admin controls at /admin/attributes.
 */
const HIGHLIGHT_PRIORITY = ['capacity', 'parking', 'rooms', 'halls']

/**
 * Photo counts and headline numbers for one page of results.
 *
 * Deliberately two follow-up queries rather than columns on `search_vendors`:
 * that function is the search contract and swapping in an external engine later
 * should not mean re-teaching it about amenities. Both queries are bounded by
 * the page size, and neither runs for an empty page.
 */
async function enrichResults(
  supabase: ReturnType<typeof createPublicClient>,
  results: VendorSearchResult[],
): Promise<VendorSearchResult[]> {
  if (results.length === 0) return results
  const ids = results.map((r) => r.vendorId)

  const [media, answers] = await Promise.all([
    supabase
      .from('vendor_media')
      .select('vendor_id')
      .in('vendor_id', ids)
      .eq('moderation_status', 'approved')
      .then((result) => result.data ?? []),
    supabase
      .from('vendor_attribute_values')
      .select('vendor_id, value_json, category_attributes(code, label, unit, data_type, sort_order)')
      .in('vendor_id', ids)
      .then((result) => result.data ?? []),
  ])

  const photos = new Map<string, number>()
  for (const row of media) photos.set(row.vendor_id, (photos.get(row.vendor_id) ?? 0) + 1)

  const highlights = new Map<string, (VendorHighlight & { rank: number; order: number })[]>()
  for (const row of answers) {
    const definition = row.category_attributes
    if (!definition || definition.data_type !== 'number') continue
    // Money is a price, not a facility — the card prints that separately.
    if (definition.unit === 'INR') continue
    if (typeof row.value_json !== 'number') continue

    const priority = HIGHLIGHT_PRIORITY.indexOf(definition.code)
    const list = highlights.get(row.vendor_id) ?? []
    list.push({
      code: definition.code,
      value: row.value_json,
      noun: definition.unit ?? definition.label,
      rank: priority === -1 ? HIGHLIGHT_PRIORITY.length : priority,
      order: definition.sort_order,
    })
    highlights.set(row.vendor_id, list)
  }

  return results.map((result) => ({
    ...result,
    photoCount: photos.get(result.vendorId) ?? 0,
    highlights: (highlights.get(result.vendorId) ?? [])
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .slice(0, 2)
      .map(({ code, value, noun }) => ({ code, value, noun })),
  }))
}

export interface SearchPage {
  results: VendorSearchResult[]
  total: number
  limit: number
  offset: number
}

interface SearchRow {
  vendor_id: string
  slug: string
  display_name: string
  city_slug: string | null
  city_name: string | null
  rating_average: number | string
  rating_count: number
  verification_status: string
  is_featured: boolean
  starting_amount_minor: number | string | null
  currency: string
  cover_path: string | null
  rank_score: number | string
  total_count: number | string
}

export async function searchVendors(input: Partial<SearchFilters>): Promise<SearchPage> {
  const filters = searchFiltersSchema.parse(input)

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase.rpc('search_vendors', {
      filters: {
        q: filters.q ?? null,
        categorySlug: filters.category ?? null,
        citySlug: filters.city ?? null,
        minRating: filters.minRating ?? null,
        verifiedOnly: filters.verifiedOnly,
        budgetMinMinor: filters.budgetMinMinor ?? null,
        budgetMaxMinor: filters.budgetMaxMinor ?? null,
        attributes: filters.attributes,
        sort: filters.sort,
        limit: filters.limit,
        offset: (filters.page - 1) * filters.limit,
      },
    })

    if (error) throw error

    const rows = (data ?? []) as unknown as SearchRow[]

    const results = await enrichResults(
      supabase,
      rows.map((row) => ({
        vendorId: row.vendor_id,
        slug: row.slug,
        displayName: row.display_name,
        citySlug: row.city_slug,
        cityName: row.city_name,
        ratingAverage: Number(row.rating_average),
        ratingCount: Number(row.rating_count),
        verificationStatus: row.verification_status,
        isFeatured: row.is_featured,
        startingAmountMinor:
          row.starting_amount_minor === null ? null : Number(row.starting_amount_minor),
        currency: row.currency,
        coverPath: row.cover_path,
        rankScore: Number(row.rank_score),
        photoCount: 0,
        highlights: [],
      })),
    )

    return {
      results,
      total: rows.length > 0 ? Number(rows[0].total_count) : 0,
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    }
  } catch (error) {
    logError('dal.searchVendors', error, { filters })
    return { results: [], total: 0, limit: filters.limit, offset: 0 }
  }
}
