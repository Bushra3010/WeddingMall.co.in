import 'server-only'

import { cache } from 'react'

import { createPublicClient } from '@/lib/supabase/public'
import { logError } from '@/lib/observability/logger'

/**
 * Homepage content (PRD 6.1).
 *
 * Every number here is counted from live data. PRD 6.1 acceptance is explicit
 * that "no unverifiable numerical claim is hard-coded" — so a stat with
 * nothing behind it is omitted rather than invented, and the homepage renders
 * whatever is actually true today.
 */

export interface HomeStat {
  key: string
  value: number
  /** Rendered after the counted value, e.g. "+" or "/5". */
  suffix?: string
  label: string
  /** One decimal place for a rating, none for a count. */
  decimals?: number
}

/**
 * Shape of `homepage_stats()`. The type generator emits `Returns: unknown` for
 * every function, so RPC rows are declared here and cast — the same pattern as
 * `search_vendors` in `dal/search.ts`.
 *
 * `bigint` and `numeric` arrive from PostgREST as JSON *strings*, because
 * neither fits an IEEE double faithfully. Every field is therefore widened and
 * pushed through `Number()` rather than trusted.
 */
interface HomeStatsRow {
  vendors_total: number | string
  vendors_verified: number | string
  cities_total: number | string
  categories_total: number | string
  rating_average: number | string
  rating_count: number | string
}

/**
 * One round trip, aggregated in SQL (migration `0017`).
 *
 * This previously ran five queries, four of them through `public_vendors` —
 * whose lateral join rebuilds a listing snapshot per row, which a `count(*)`
 * has no use for — and a fifth that selected `rating_average, rating_count`
 * for every vendor in order to average them in JavaScript. That last one grew
 * linearly with the catalogue and discarded every row after summing.
 */
export const getHomeStats = cache(async (): Promise<HomeStat[]> => {
  try {
    const supabase = createPublicClient()

    const { data, error } = await supabase.rpc('homepage_stats')
    if (error) throw error

    const row = ((data ?? []) as unknown as HomeStatsRow[])[0]
    if (!row) return []

    const vendors = Number(row.vendors_total ?? 0)
    const verified = Number(row.vendors_verified ?? 0)
    const totalReviews = Number(row.rating_count ?? 0)
    const average = Number(row.rating_average ?? 0)

    const stats: HomeStat[] = [
      { key: 'vendors', value: verified || vendors, suffix: '+', label: 'Verified vendors' },
      {
        key: 'cities',
        value: Number(row.cities_total ?? 0),
        suffix: '+',
        label: 'Cities covered',
      },
      {
        key: 'categories',
        value: Number(row.categories_total ?? 0),
        suffix: '+',
        label: 'Service categories',
      },
    ]

    // Only claim a rating when approved reviews actually back it (PRD 11.2).
    if (totalReviews > 0) {
      stats.push({
        key: 'rating',
        value: average,
        suffix: '/5',
        label: 'Average rating',
        decimals: 1,
      })
    }

    return stats.filter((stat) => stat.value > 0)
  } catch (error) {
    logError('dal.getHomeStats', error)
    return []
  }
})

export interface CategoryTile {
  id: string
  name: string
  slug: string
  description: string | null
  vendorCount: number
  /**
   * Cover image of a published vendor in this category, or null. Categories
   * have no image column of their own, and inventing one would mean an admin
   * hand-picking stock photography; borrowing a real listing's approved cover
   * means the tile illustrates itself with genuine work as soon as any vendor
   * uploads. Null until then — the tile falls back to its icon.
   */
  imagePath: string | null
}

/** Shape of `category_tiles()`; see the note on `HomeStatsRow`. */
interface CategoryTileRow {
  id: string
  name: string
  slug: string
  description: string | null
  vendor_count: number | string
  image_path: string | null
}

/**
 * Categories with a live vendor count, ordered as the admin arranged them.
 *
 * Counting and cover selection happen in SQL (migration `0017`). The previous
 * version pulled every row of `vendor_categories` with its nested media and
 * did both in JavaScript — correct, but linear in the size of the catalogue
 * for a component that renders at most twelve tiles.
 */
export const getCategoryTiles = cache(async (limit = 12): Promise<CategoryTile[]> => {
  try {
    const supabase = createPublicClient()

    const { data, error } = await supabase.rpc('category_tiles', { p_limit: limit })
    if (error) throw error

    return ((data ?? []) as unknown as CategoryTileRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      vendorCount: Number(row.vendor_count ?? 0),
      imagePath: row.image_path,
    }))
  } catch (error) {
    logError('dal.getCategoryTiles', error)
    return []
  }
})

export interface Testimonial {
  id: string
  authorName: string
  authorCity: string | null
  body: string
}

export const getTestimonials = cache(async (limit = 6): Promise<Testimonial[]> => {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('testimonials')
      .select('id, author_name, author_city, body')
      .eq('active', true)
      .order('sort_order')
      .limit(limit)
    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      authorName: row.author_name,
      authorCity: row.author_city,
      body: row.body,
    }))
  } catch (error) {
    logError('dal.getTestimonials', error)
    return []
  }
})

/**
 * Homepage section configuration (PRD 6.1: sections can be hidden and reordered
 * by admin configuration, and the hero image is set rather than hard-coded).
 */
export interface HomepageSection {
  code: string
  title: string | null
  config: Record<string, unknown>
  sortOrder: number
}

export const getHomepageSections = cache(async (): Promise<Map<string, HomepageSection>> => {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('homepage_sections')
      .select('code, title, config_json, sort_order')
      .eq('active', true)
      .order('sort_order')
    if (error) throw error

    return new Map(
      (data ?? []).map((row) => [
        row.code,
        {
          code: row.code,
          title: row.title,
          config: (row.config_json ?? {}) as Record<string, unknown>,
          sortOrder: row.sort_order,
        },
      ]),
    )
  } catch (error) {
    logError('dal.getHomepageSections', error)
    return new Map()
  }
})
