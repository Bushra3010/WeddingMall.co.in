import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'
import { calculateCompletion, type CompletionResult } from '@/features/vendors/completion'

/**
 * Vendor workspace reads. These use the request-scoped (session) client, so RLS
 * decides what the signed-in member can see — the queries do not re-filter by
 * membership themselves.
 */

export interface VendorWorkspace {
  id: string
  displayName: string
  legalName: string | null
  slug: string
  status: string
  verificationStatus: string
  primaryCityId: string | null
  email: string | null
  phone: string | null
  website: string | null
  foundedYear: number | null
  submittedAt: string | null
  publishedAt: string | null
  rejectionReason: string | null
  suspendedReason: string | null
  about: string | null
  experienceYears: number | null
  languages: string[]
  listingStatus: string | null
  categoryIds: string[]
  primaryCategoryId: string | null
  serviceAreaCityIds: string[]
  packageCount: number
  mediaCount: number
  documentCount: number
  completion: CompletionResult
}

export const getVendorWorkspace = cache(
  async (vendorId: string): Promise<VendorWorkspace | null> => {
    try {
      const supabase = await createClient()

      const { data: vendor, error } = await supabase
        .from('vendors')
        .select(
          'id, display_name, legal_name, slug, status, verification_status, primary_city_id, email, phone, website, founded_year, submitted_at, published_at, rejection_reason, suspended_reason',
        )
        .eq('id', vendorId)
        .maybeSingle()

      if (error) throw error
      if (!vendor) return null

      const [listing, categories, areas, packages, media, documents] = await Promise.all([
        supabase
          .from('vendor_listings')
          .select('status, about, experience_years, languages')
          .eq('vendor_id', vendorId)
          .maybeSingle()
          .then((r) => r.data),
        supabase
          .from('vendor_categories')
          .select('category_id, is_primary')
          .eq('vendor_id', vendorId)
          .then((r) => r.data ?? []),
        supabase
          .from('vendor_service_areas')
          .select('city_id')
          .eq('vendor_id', vendorId)
          .then((r) => r.data ?? []),
        supabase
          .from('vendor_packages')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .then((r) => r.count ?? 0),
        supabase
          .from('vendor_media')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .then((r) => r.count ?? 0),
        supabase
          .from('vendor_verifications')
          .select('vendor_documents(id)')
          .eq('vendor_id', vendorId)
          .then((r) =>
            (r.data ?? []).reduce((n, row) => n + (row.vendor_documents?.length ?? 0), 0),
          ),
      ])

      const completion = calculateCompletion({
        displayName: vendor.display_name,
        primaryCityId: vendor.primary_city_id,
        categoryCount: categories.length,
        serviceAreaCount: areas.length,
        about: listing?.about ?? null,
        experienceYears: listing?.experience_years ?? null,
        phone: vendor.phone,
        email: vendor.email,
        website: vendor.website,
        packageCount: packages,
        mediaCount: media,
        documentCount: documents,
      })

      return {
        id: vendor.id,
        displayName: vendor.display_name,
        legalName: vendor.legal_name,
        slug: vendor.slug,
        status: vendor.status,
        verificationStatus: vendor.verification_status,
        primaryCityId: vendor.primary_city_id,
        email: vendor.email,
        phone: vendor.phone,
        website: vendor.website,
        foundedYear: vendor.founded_year,
        submittedAt: vendor.submitted_at,
        publishedAt: vendor.published_at,
        rejectionReason: vendor.rejection_reason,
        suspendedReason: vendor.suspended_reason,
        about: listing?.about ?? null,
        experienceYears: listing?.experience_years ?? null,
        languages: listing?.languages ?? [],
        listingStatus: listing?.status ?? null,
        categoryIds: categories.map((c) => c.category_id),
        primaryCategoryId: categories.find((c) => c.is_primary)?.category_id ?? null,
        serviceAreaCityIds: areas.map((a) => a.city_id),
        packageCount: packages,
        mediaCount: media,
        documentCount: documents,
        completion,
      }
    } catch (error) {
      logError('dal.getVendorWorkspace', error, { vendorId })
      return null
    }
  },
)

export interface TeamMember {
  id: string
  userId: string
  role: string
  status: string
  invitedEmail: string | null
  fullName: string | null
  isOwner: boolean
}

export async function getTeam(vendorId: string): Promise<TeamMember[]> {
  try {
    const supabase = await createClient()
    const [{ data: rows, error }, { data: vendor }] = await Promise.all([
      supabase
        .from('vendor_memberships')
        .select(
          'id, user_id, role, status, invited_email, profiles!vendor_memberships_user_id_fkey(full_name)',
        )
        .eq('vendor_id', vendorId)
        .order('created_at'),
      supabase.from('vendors').select('owner_user_id').eq('id', vendorId).maybeSingle(),
    ])
    if (error) throw error

    return (rows ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      invitedEmail: row.invited_email,
      fullName: row.profiles?.full_name ?? null,
      isOwner: row.user_id === vendor?.owner_user_id,
    }))
  } catch (error) {
    logError('dal.getTeam', error, { vendorId })
    return []
  }
}

export interface VerificationDocument {
  id: string
  documentType: string
  storagePath: string
  createdAt: string
  verificationStatus: string
  reason: string | null
}

export async function getVerificationDocuments(vendorId: string): Promise<VerificationDocument[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vendor_verifications')
      .select('id, status, reason, vendor_documents(id, document_type, storage_path, created_at)')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []).flatMap((verification) =>
      (verification.vendor_documents ?? []).map((doc) => ({
        id: doc.id,
        documentType: doc.document_type,
        storagePath: doc.storage_path,
        createdAt: doc.created_at,
        verificationStatus: verification.status,
        reason: verification.reason,
      })),
    )
  } catch (error) {
    logError('dal.getVerificationDocuments', error, { vendorId })
    return []
  }
}

/** Vendors the signed-in user belongs to, for the workspace switcher. */
export const getMyVendors = cache(async () => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vendor_memberships')
      .select('role, status, vendors(id, display_name, slug, status)')
      .eq('status', 'active')
    if (error) throw error
    return (data ?? [])
      .filter((row) => row.vendors)
      .map((row) => ({ role: row.role, vendor: row.vendors! }))
  } catch (error) {
    logError('dal.getMyVendors', error)
    return []
  }
})
