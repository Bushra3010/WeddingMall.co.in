import 'server-only'

import { cache } from 'react'

import { createPublicClient } from '@/lib/supabase/public'
import { logError } from '@/lib/observability/logger'

/**
 * CMS reads (PRD 6.11, 9.5).
 *
 * Uses the cookie-free public client so the blog stays statically rendered
 * (ADR-030). RLS already restricts anon to `status = 'published'`, so an
 * unpublished draft cannot reach these functions even if a filter were
 * forgotten — but the filters are here too, because a read path should say
 * what it means.
 */

export interface PostSummary {
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  coverPath: string | null
  publishedAt: string | null
}

export interface PostDetail extends PostSummary {
  body: string | null
  seoTitle: string | null
  seoDescription: string | null
}

export const listPosts = cache(async (limit = 30): Promise<PostSummary[]> => {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('posts')
      .select('slug, title, excerpt, category, cover_path, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error) throw error

    return (data ?? []).map((row) => ({
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      category: row.category,
      coverPath: row.cover_path,
      publishedAt: row.published_at,
    }))
  } catch (error) {
    logError('dal.listPosts', error)
    return []
  }
})

export const getPost = cache(async (slug: string): Promise<PostDetail | null> => {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('posts')
      .select(
        'slug, title, excerpt, body, category, cover_path, published_at, seo_title, seo_description',
      )
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt,
      body: data.body,
      category: data.category,
      coverPath: data.cover_path,
      publishedAt: data.published_at,
      seoTitle: data.seo_title,
      seoDescription: data.seo_description,
    }
  } catch (error) {
    logError('dal.getPost', error, { slug })
    return null
  }
})
