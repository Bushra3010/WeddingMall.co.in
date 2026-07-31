import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'

/** Vendor-workspace reads for packages, media, availability, and versions. */

export interface VendorPackageRow {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  priceType: string
  minAmountMinor: number | null
  maxAmountMinor: number | null
  currency: string
  unit: string | null
  inclusions: string[]
  exclusions: string[]
  active: boolean
  sortOrder: number
}

export async function getVendorPackages(vendorId: string): Promise<VendorPackageRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vendor_packages')
      .select(
        'id, name, description, category_id, price_type, min_amount_minor, max_amount_minor, currency, unit, inclusions_json, exclusions_json, active, sort_order',
      )
      .eq('vendor_id', vendorId)
      .order('sort_order')
    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      categoryId: row.category_id,
      priceType: row.price_type,
      minAmountMinor: row.min_amount_minor,
      maxAmountMinor: row.max_amount_minor,
      currency: row.currency,
      unit: row.unit,
      inclusions: Array.isArray(row.inclusions_json) ? (row.inclusions_json as string[]) : [],
      exclusions: Array.isArray(row.exclusions_json) ? (row.exclusions_json as string[]) : [],
      active: row.active,
      sortOrder: row.sort_order,
    }))
  } catch (error) {
    logError('dal.getVendorPackages', error, { vendorId })
    return []
  }
}

export interface VendorMediaRow {
  id: string
  storagePath: string
  altText: string | null
  isCover: boolean
  sortOrder: number
  moderationStatus: string
}

export async function getVendorMedia(vendorId: string): Promise<VendorMediaRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vendor_media')
      .select('id, storage_path, alt_text, is_cover, sort_order, moderation_status')
      .eq('vendor_id', vendorId)
      .order('sort_order')
    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      storagePath: row.storage_path,
      altText: row.alt_text,
      isCover: row.is_cover,
      sortOrder: row.sort_order,
      moderationStatus: row.moderation_status,
    }))
  } catch (error) {
    logError('dal.getVendorMedia', error, { vendorId })
    return []
  }
}

export interface AvailabilityRow {
  id: string
  startDate: string
  endDate: string
  status: string
  note: string | null
}

export async function getVendorAvailability(vendorId: string): Promise<AvailabilityRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vendor_availability')
      .select('id, start_date, end_date, status, note_private')
      .eq('vendor_id', vendorId)
      .order('start_date', { ascending: true })
    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      note: row.note_private,
    }))
  } catch (error) {
    logError('dal.getVendorAvailability', error, { vendorId })
    return []
  }
}

export interface ListingVersionRow {
  id: string
  versionNo: number
  status: string
  reason: string | null
  createdAt: string
  publishedAt: string | null
}

export async function getListingVersions(vendorId: string): Promise<ListingVersionRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vendor_listing_versions')
      .select('id, version_no, status, reason, created_at, published_at')
      .eq('vendor_id', vendorId)
      .order('version_no', { ascending: false })
      .limit(20)
    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      versionNo: row.version_no,
      status: row.status,
      reason: row.reason,
      createdAt: row.created_at,
      publishedAt: row.published_at,
    }))
  } catch (error) {
    logError('dal.getListingVersions', error, { vendorId })
    return []
  }
}

/** Pending listing edits awaiting moderation (PRD 6.11). */
export interface ListingReviewRow {
  versionId: string
  versionNo: number
  vendorId: string
  vendorName: string
  vendorSlug: string
  createdAt: string
  about: string | null
  isFirstPublication: boolean
}

export async function getListingReviewQueue(): Promise<ListingReviewRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vendor_listing_versions')
      .select('id, version_no, vendor_id, created_at, snapshot_json, vendors(display_name, slug)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100)
    if (error) throw error

    return (data ?? []).map((row) => {
      const snapshot = (row.snapshot_json ?? {}) as Record<string, unknown>
      return {
        versionId: row.id,
        versionNo: row.version_no,
        vendorId: row.vendor_id,
        vendorName: row.vendors?.display_name ?? 'Unknown business',
        vendorSlug: row.vendors?.slug ?? '',
        createdAt: row.created_at,
        about: typeof snapshot.about === 'string' ? snapshot.about : null,
        isFirstPublication: row.version_no === 1,
      }
    })
  } catch (error) {
    logError('dal.getListingReviewQueue', error)
    return []
  }
}

/**
 * The pending snapshot alongside what is currently published, so a moderator
 * can see what is actually changing rather than re-reading the whole listing.
 */
export async function getVersionComparison(versionId: string) {
  try {
    const supabase = await createClient()
    const { data: pending, error } = await supabase
      .from('vendor_listing_versions')
      .select('id, version_no, vendor_id, snapshot_json, created_at, vendors(display_name, slug)')
      .eq('id', versionId)
      .maybeSingle()
    if (error) throw error
    if (!pending) return null

    const { data: published } = await supabase
      .from('vendor_listing_versions')
      .select('version_no, snapshot_json, published_at')
      .eq('vendor_id', pending.vendor_id)
      .eq('status', 'approved')
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      versionId: pending.id,
      versionNo: pending.version_no,
      vendorId: pending.vendor_id,
      vendorName: pending.vendors?.display_name ?? 'Unknown business',
      vendorSlug: pending.vendors?.slug ?? '',
      createdAt: pending.created_at,
      pending: (pending.snapshot_json ?? {}) as Record<string, unknown>,
      published: (published?.snapshot_json ?? null) as Record<string, unknown> | null,
      publishedVersionNo: published?.version_no ?? null,
    }
  } catch (error) {
    logError('dal.getVersionComparison', error, { versionId })
    return null
  }
}
