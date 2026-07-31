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

/**
 * Resolves an outdated slug to its current value (PRD 11.2).
 *
 * Returns null when there is no redirect, which the caller treats as a genuine
 * 404. Called only on the miss path, so it costs nothing on a normal request.
 */
export async function resolveSlugRedirect(
  kind: 'vendor' | 'category' | 'city' | 'post' | 'page',
  candidate: string,
): Promise<string | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase.rpc('resolve_slug_redirect', {
      kind,
      candidate,
    })
    if (error) throw error
    return (data as string | null) ?? null
  } catch (error) {
    logError('dal.resolveSlugRedirect', error, { kind, candidate })
    return null
  }
}

export interface AttributeDefinition {
  id: string
  categoryId: string
  code: string
  label: string
  helpText: string | null
  inputType: string
  dataType: string
  unit: string | null
  filterable: boolean
  required: boolean
  options: string[]
  sortOrder: number
}

function mapAttribute(row: {
  id: string
  category_id: string
  code: string
  label: string
  help_text: string | null
  input_type: string
  data_type: string
  unit: string | null
  filterable: boolean
  required: boolean
  options_json: unknown
  sort_order: number
}): AttributeDefinition {
  return {
    id: row.id,
    categoryId: row.category_id,
    code: row.code,
    label: row.label,
    helpText: row.help_text,
    inputType: row.input_type,
    dataType: row.data_type,
    unit: row.unit,
    filterable: row.filterable,
    required: row.required,
    options: Array.isArray(row.options_json) ? (row.options_json as string[]) : [],
    sortOrder: row.sort_order,
  }
}

const ATTRIBUTE_COLUMNS =
  'id, category_id, code, label, help_text, input_type, data_type, unit, filterable, required, options_json, sort_order'

export const listAttributes = cache(async (): Promise<AttributeDefinition[]> => {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('category_attributes')
      .select(ATTRIBUTE_COLUMNS)
      .order('sort_order')
    if (error) throw error
    return (data ?? []).map(mapAttribute)
  } catch (error) {
    logError('dal.listAttributes', error)
    return []
  }
})

/** Filterable attributes for one category — drives the search sidebar. */
export const listFilterableAttributes = cache(
  async (categorySlug: string): Promise<AttributeDefinition[]> => {
    try {
      const supabase = createPublicClient()
      const category = await getCategoryBySlug(categorySlug)
      if (!category) return []

      const { data, error } = await supabase
        .from('category_attributes')
        .select(ATTRIBUTE_COLUMNS)
        .eq('category_id', category.id)
        .eq('filterable', true)
        .order('sort_order')
      if (error) throw error
      return (data ?? []).map(mapAttribute)
    } catch (error) {
      logError('dal.listFilterableAttributes', error, { categorySlug })
      return []
    }
  },
)
