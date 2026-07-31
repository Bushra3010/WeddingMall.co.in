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

export async function searchVendors(input: SearchFilters): Promise<SearchPage> {
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
        sort: filters.sort,
        limit: filters.limit,
        offset: (filters.page - 1) * filters.limit,
      },
    })

    if (error) throw error

    const rows = (data ?? []) as unknown as SearchRow[]

    return {
      results: rows.map((row) => ({
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
      })),
      total: rows.length > 0 ? Number(rows[0].total_count) : 0,
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    }
  } catch (error) {
    logError('dal.searchVendors', error, { filters })
    return { results: [], total: 0, limit: filters.limit, offset: 0 }
  }
}
