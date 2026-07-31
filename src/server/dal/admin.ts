import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Enums } from '@/types/database'
import { logError } from '@/lib/observability/logger'

/**
 * Admin reads. These use the session client, so an admin without the relevant
 * permission simply sees nothing — RLS, not a UI check, is what withholds it.
 */

export interface ReviewQueueRow {
  id: string
  displayName: string
  slug: string
  status: string
  verificationStatus: string
  submittedAt: string | null
  cityName: string | null
  categoryName: string | null
  documentCount: number
}

export type VendorStatus = Enums<'vendor_status'>

export async function getReviewQueue(
  status: VendorStatus = 'pending_review',
): Promise<ReviewQueueRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vendors')
      .select(
        'id, display_name, slug, status, verification_status, submitted_at, cities(name), vendor_categories(is_primary, categories(name)), vendor_verifications(status, vendor_documents(id))',
      )
      .eq('status', status)
      .order('submitted_at', { ascending: true, nullsFirst: false })
      .limit(100)

    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      slug: row.slug,
      status: row.status,
      verificationStatus: row.verification_status,
      submittedAt: row.submitted_at,
      cityName: row.cities?.name ?? null,
      categoryName: row.vendor_categories?.find((c) => c.is_primary)?.categories?.name ?? null,
      documentCount: (row.vendor_verifications ?? []).reduce(
        (n, v) => n + (v.vendor_documents?.length ?? 0),
        0,
      ),
    }))
  } catch (error) {
    logError('dal.getReviewQueue', error, { status })
    return []
  }
}

export async function getAdminDashboardCounts() {
  const empty = {
    pendingReview: 0,
    activeVendors: 0,
    draftVendors: 0,
    suspendedVendors: 0,
    rejectedVendors: 0,
    categories: 0,
    cities: 0,
  }

  try {
    const supabase = await createClient()
    const vendorsWithStatus = (status: VendorStatus) =>
      supabase
        .from('vendors')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
        .then((r) => r.count ?? 0)

    const [pending, active, draft, suspended, rejected, categories, cities] = await Promise.all([
      vendorsWithStatus('pending_review'),
      vendorsWithStatus('active'),
      vendorsWithStatus('draft'),
      vendorsWithStatus('suspended'),
      vendorsWithStatus('rejected'),
      supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .then((r) => r.count ?? 0),
      supabase
        .from('cities')
        .select('id', { count: 'exact', head: true })
        .then((r) => r.count ?? 0),
    ])

    return {
      pendingReview: pending,
      activeVendors: active,
      draftVendors: draft,
      suspendedVendors: suspended,
      rejectedVendors: rejected,
      categories,
      cities,
    }
  } catch (error) {
    logError('dal.getAdminDashboardCounts', error)
    return empty
  }
}

export interface AdminVendorDetail {
  id: string
  displayName: string
  legalName: string | null
  slug: string
  status: string
  verificationStatus: string
  email: string | null
  phone: string | null
  website: string | null
  foundedYear: number | null
  submittedAt: string | null
  publishedAt: string | null
  rejectionReason: string | null
  suspendedReason: string | null
  cityName: string | null
  about: string | null
  experienceYears: number | null
  categories: string[]
  serviceAreas: string[]
  documents: { id: string; documentType: string; createdAt: string }[]
  ownerName: string | null
  members: { role: string; status: string; fullName: string | null }[]
}

export async function getAdminVendor(vendorId: string): Promise<AdminVendorDetail | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vendors')
      .select(
        `id, display_name, legal_name, slug, status, verification_status, email, phone, website,
         founded_year, submitted_at, published_at, rejection_reason, suspended_reason,
         cities(name),
         vendor_listings(about, experience_years),
         vendor_categories(categories(name)),
         vendor_service_areas(cities(name)),
         vendor_verifications(vendor_documents(id, document_type, created_at)),
         vendor_memberships(role, status, profiles!vendor_memberships_user_id_fkey(full_name))`,
      )
      .eq('id', vendorId)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const listing = Array.isArray(data.vendor_listings)
      ? data.vendor_listings[0]
      : data.vendor_listings

    return {
      id: data.id,
      displayName: data.display_name,
      legalName: data.legal_name,
      slug: data.slug,
      status: data.status,
      verificationStatus: data.verification_status,
      email: data.email,
      phone: data.phone,
      website: data.website,
      foundedYear: data.founded_year,
      submittedAt: data.submitted_at,
      publishedAt: data.published_at,
      rejectionReason: data.rejection_reason,
      suspendedReason: data.suspended_reason,
      cityName: data.cities?.name ?? null,
      about: listing?.about ?? null,
      experienceYears: listing?.experience_years ?? null,
      categories: (data.vendor_categories ?? [])
        .map((c) => c.categories?.name)
        .filter((n): n is string => Boolean(n)),
      serviceAreas: (data.vendor_service_areas ?? [])
        .map((a) => a.cities?.name)
        .filter((n): n is string => Boolean(n)),
      documents: (data.vendor_verifications ?? []).flatMap((v) =>
        (v.vendor_documents ?? []).map((d) => ({
          id: d.id,
          documentType: d.document_type,
          createdAt: d.created_at,
        })),
      ),
      ownerName:
        (data.vendor_memberships ?? []).find((m) => m.role === 'vendor_owner')?.profiles
          ?.full_name ?? null,
      members: (data.vendor_memberships ?? []).map((m) => ({
        role: m.role,
        status: m.status,
        fullName: m.profiles?.full_name ?? null,
      })),
    }
  } catch (error) {
    logError('dal.getAdminVendor', error, { vendorId })
    return null
  }
}

export async function getAuditTrail(entityId: string, limit = 50) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, reason, created_at, actor_type, before_json, after_json')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  } catch (error) {
    logError('dal.getAuditTrail', error, { entityId })
    return []
  }
}
