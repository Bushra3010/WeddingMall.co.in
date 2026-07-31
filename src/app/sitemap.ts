import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/seo'
import { createPublicClient } from '@/lib/supabase/public'
import { logError } from '@/lib/observability/logger'

export const revalidate = 3600

/**
 * Only indexable content is listed (PRD 11.1): category pages, category × city
 * pages, published vendor profiles, and published posts. Open-ended /vendors
 * search combinations are deliberately excluded.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/categories'), changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/cities'), changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/blog'), changeFrequency: 'weekly', priority: 0.6 },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.3 },
    { url: absoluteUrl('/contact'), changeFrequency: 'monthly', priority: 0.3 },
    { url: absoluteUrl('/help'), changeFrequency: 'monthly', priority: 0.3 },
    { url: absoluteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/terms'), changeFrequency: 'yearly', priority: 0.2 },
  ]

  try {
    const supabase = createPublicClient()

    const [categories, cities, vendors, posts] = await Promise.all([
      supabase.from('categories').select('slug, updated_at').eq('active', true),
      supabase.from('cities').select('slug, updated_at').eq('active', true),
      supabase
        .from('public_vendors')
        .select('slug, published_at')
        .order('published_at', { ascending: false })
        .limit(5000),
      supabase.from('posts').select('slug, published_at').eq('status', 'published'),
    ])

    const categoryRows = categories.data ?? []
    const cityRows = cities.data ?? []

    const categoryEntries: MetadataRoute.Sitemap = categoryRows.map((row) => ({
      url: absoluteUrl(`/vendors/${row.slug}`),
      lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
      changeFrequency: 'daily',
      priority: 0.9,
    }))

    /*
     * Category × city is a cross product, so it is capped. Publishing tens of
     * thousands of near-empty combinations is explicitly forbidden (PRD 11.2);
     * emit them only for the combinations most likely to have inventory.
     */
    const crossEntries: MetadataRoute.Sitemap = categoryRows
      .flatMap((category) =>
        cityRows.map((city) => ({
          url: absoluteUrl(`/vendors/${category.slug}/${city.slug}`),
          changeFrequency: 'daily' as const,
          priority: 0.8,
        })),
      )
      .slice(0, 5000)

    const vendorEntries: MetadataRoute.Sitemap = (vendors.data ?? []).map((row) => ({
      url: absoluteUrl(`/vendor/${row.slug}`),
      lastModified: row.published_at ? new Date(row.published_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    const postEntries: MetadataRoute.Sitemap = (posts.data ?? []).map((row) => ({
      url: absoluteUrl(`/blog/${row.slug}`),
      lastModified: row.published_at ? new Date(row.published_at) : undefined,
      changeFrequency: 'monthly',
      priority: 0.5,
    }))

    return [...staticEntries, ...categoryEntries, ...crossEntries, ...vendorEntries, ...postEntries]
  } catch (error) {
    logError('sitemap', error)
    return staticEntries
  }
}
