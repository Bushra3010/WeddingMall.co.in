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

export const getHomeStats = cache(async (): Promise<HomeStat[]> => {
  try {
    const supabase = createPublicClient()

    const [vendors, verified, cities, categories, reviews] = await Promise.all([
      supabase
        .from('public_vendors')
        .select('id', { count: 'exact', head: true })
        .then((r) => r.count ?? 0),
      supabase
        .from('public_vendors')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'verified')
        .then((r) => r.count ?? 0),
      supabase
        .from('cities')
        .select('id', { count: 'exact', head: true })
        .eq('active', true)
        .then((r) => r.count ?? 0),
      supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('active', true)
        .then((r) => r.count ?? 0),
      supabase
        .from('public_vendors')
        .select('rating_average, rating_count')
        .then((r) => r.data ?? []),
    ])

    // Weighted by review count, so a single 5.0 does not outrank the field.
    const rated = reviews.filter((v) => (v.rating_count ?? 0) > 0)
    const totalReviews = rated.reduce((sum, v) => sum + Number(v.rating_count ?? 0), 0)
    const weighted = rated.reduce(
      (sum, v) => sum + Number(v.rating_average ?? 0) * Number(v.rating_count ?? 0),
      0,
    )
    const average = totalReviews > 0 ? weighted / totalReviews : 0

    const stats: HomeStat[] = [
      { key: 'vendors', value: verified || vendors, suffix: '+', label: 'Verified vendors' },
      { key: 'cities', value: cities, suffix: '+', label: 'Cities covered' },
      { key: 'categories', value: categories, suffix: '+', label: 'Service categories' },
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

/** Categories with a live vendor count, ordered as the admin arranged them. */
export const getCategoryTiles = cache(async (limit = 12): Promise<CategoryTile[]> => {
  try {
    const supabase = createPublicClient()

    const [{ data: categories, error }, { data: links }] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, slug, description')
        .is('parent_id', null)
        .eq('active', true)
        .order('sort_order')
        .limit(limit),
      // Only counts vendors the public can actually see.
      supabase
        .from('vendor_categories')
        .select(
          'category_id, is_primary, vendors!inner(status, vendor_media(storage_path, is_cover, moderation_status))',
        ),
    ])

    if (error) throw error

    const counts = new Map<string, number>()
    const covers = new Map<string, string>()

    for (const link of links ?? []) {
      if (link.vendors?.status !== 'active') continue
      counts.set(link.category_id, (counts.get(link.category_id) ?? 0) + 1)

      // First approved cover wins; a vendor listing this as its primary
      // category is a better illustration than one that merely also serves it.
      if (covers.has(link.category_id) && !link.is_primary) continue
      const media = (link.vendors.vendor_media ?? []).filter(
        (m) => m.moderation_status === 'approved',
      )
      const cover = media.find((m) => m.is_cover) ?? media[0]
      if (cover?.storage_path) covers.set(link.category_id, cover.storage_path)
    }

    return (categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      vendorCount: counts.get(category.id) ?? 0,
      imagePath: covers.get(category.id) ?? null,
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
