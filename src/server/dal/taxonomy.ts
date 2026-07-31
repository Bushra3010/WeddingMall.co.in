import 'server-only'

import { cache } from 'react'

import { createPublicClient } from '@/lib/supabase/public'
import { logError } from '@/lib/observability/logger'

/**
 * Taxonomy reads (PRD 9.2). These are public, cacheable, and must degrade to an
 * empty list rather than throwing — a misconfigured database should not take
 * the marketing pages down (PRD 14.2).
 */

export interface CategoryRow {
  id: string
  name: string
  slug: string
  icon: string | null
  description: string | null
}

export interface CityRow {
  id: string
  name: string
  slug: string
}

export const listCategories = cache(async (limit = 24): Promise<CategoryRow[]> => {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, icon, description')
      .is('parent_id', null)
      .eq('active', true)
      .order('sort_order')
      .limit(limit)

    if (error) throw error
    return (data ?? []) as CategoryRow[]
  } catch (error) {
    logError('dal.listCategories', error)
    return []
  }
})

export const listCities = cache(async (limit = 24): Promise<CityRow[]> => {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('cities')
      .select('id, name, slug')
      .eq('active', true)
      .order('sort_order')
      .order('name')
      .limit(limit)

    if (error) throw error
    return (data ?? []) as CityRow[]
  } catch (error) {
    logError('dal.listCities', error)
    return []
  }
})

export const getCategoryBySlug = cache(async (slug: string) => {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug, description, intro_html, seo_title, seo_description')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()
  return data
})

export const getCityBySlug = cache(async (slug: string) => {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('cities')
    .select('id, name, slug, intro_html, seo_title, seo_description')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()
  return data
})
