import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'
import type { EnquiryStatus } from '@/features/enquiries/status'

/**
 * The generated types do not resolve a two-level embed
 * (enquiries -> conversations -> messages), so the inner shape is annotated
 * here rather than left as implicit any.
 */
type ThreadMessage = { created_at: string; read_at: string | null; sender_user_id: string }

/**
 * Enquiry, shortlist, and notification reads.
 *
 * All use the session client, so RLS decides visibility — a customer sees only
 * their own rows and a vendor member only their vendor's, without these
 * queries filtering by user themselves.
 */

export interface EnquiryListRow {
  id: string
  status: EnquiryStatus
  createdAt: string
  eventDate: string | null
  guestCount: number | null
  message: string | null
  vendorName: string
  vendorSlug: string
  categoryName: string | null
  unreadCount: number
  lastMessageAt: string | null
}

export async function getCustomerEnquiries(): Promise<EnquiryListRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('enquiries')
      .select(
        `id, status, created_at, event_date, guest_count, message,
         vendors(display_name, slug),
         categories(name),
         conversations(messages(created_at, read_at, sender_user_id))`,
      )
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const {
      data: { user },
    } = await supabase.auth.getUser()

    return (data ?? []).map((row) => {
      const conversation = Array.isArray(row.conversations)
        ? row.conversations[0]
        : row.conversations
      const messages = (conversation?.messages ?? []) as ThreadMessage[]
      return {
        id: row.id,
        status: row.status as EnquiryStatus,
        createdAt: row.created_at,
        eventDate: row.event_date,
        guestCount: row.guest_count,
        message: row.message,
        vendorName: row.vendors?.display_name ?? 'Unknown business',
        vendorSlug: row.vendors?.slug ?? '',
        categoryName: row.categories?.name ?? null,
        unreadCount: messages.filter((m) => !m.read_at && m.sender_user_id !== user?.id).length,
        lastMessageAt:
          messages.length > 0
            ? messages
                .map((m) => m.created_at)
                .sort()
                .slice(-1)[0]
            : null,
      }
    })
  } catch (error) {
    logError('dal.getCustomerEnquiries', error)
    return []
  }
}

export interface EnquiryDetail {
  id: string
  status: EnquiryStatus
  createdAt: string
  eventDate: string | null
  flexibleDate: string | null
  guestCount: number | null
  budgetMinMinor: number | null
  budgetMaxMinor: number | null
  currency: string
  message: string | null
  contactConsent: boolean
  preferredContactMode: string | null
  customerId: string
  vendorId: string
  vendorName: string
  vendorSlug: string
  categoryName: string | null
  cityName: string | null
  conversationId: string | null
  conversationStatus: string | null
}

export async function getEnquiry(enquiryId: string): Promise<EnquiryDetail | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('enquiries')
      .select(
        `id, status, created_at, event_date, flexible_date, guest_count,
         budget_min_minor, budget_max_minor, currency, message, contact_consent,
         preferred_contact_mode, customer_id, vendor_id,
         vendors(display_name, slug), categories(name), cities(name),
         conversations(id, status)`,
      )
      .eq('id', enquiryId)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const conversation = Array.isArray(data.conversations)
      ? data.conversations[0]
      : data.conversations

    return {
      id: data.id,
      status: data.status as EnquiryStatus,
      createdAt: data.created_at,
      eventDate: data.event_date,
      flexibleDate: data.flexible_date,
      guestCount: data.guest_count,
      budgetMinMinor: data.budget_min_minor,
      budgetMaxMinor: data.budget_max_minor,
      currency: data.currency,
      message: data.message,
      contactConsent: data.contact_consent,
      preferredContactMode: data.preferred_contact_mode,
      customerId: data.customer_id,
      vendorId: data.vendor_id,
      vendorName: data.vendors?.display_name ?? 'Unknown business',
      vendorSlug: data.vendors?.slug ?? '',
      categoryName: data.categories?.name ?? null,
      cityName: data.cities?.name ?? null,
      conversationId: conversation?.id ?? null,
      conversationStatus: conversation?.status ?? null,
    }
  } catch (error) {
    logError('dal.getEnquiry', error, { enquiryId })
    return null
  }
}

export interface MessageRow {
  id: string
  body: string
  senderUserId: string
  senderName: string | null
  createdAt: string
  readAt: string | null
}

export async function getMessages(conversationId: string): Promise<MessageRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('messages')
      .select(
        'id, body, sender_user_id, created_at, read_at, profiles!messages_sender_user_id_fkey(full_name)',
      )
      .eq('conversation_id', conversationId)
      .eq('status', 'sent')
      .order('created_at')

    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      senderUserId: row.sender_user_id,
      senderName: row.profiles?.full_name ?? null,
      createdAt: row.created_at,
      readAt: row.read_at,
    }))
  } catch (error) {
    logError('dal.getMessages', error, { conversationId })
    return []
  }
}

export interface TimelineEvent {
  id: string
  eventType: string
  fromStatus: string | null
  toStatus: string | null
  actorType: string
  reason: string | null
  createdAt: string
}

/** The customer-visible timeline. Internal reason codes stay private (PRD 6.6). */
export async function getEnquiryTimeline(enquiryId: string): Promise<TimelineEvent[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('enquiry_events')
      .select('id, event_type, from_status, to_status, actor_type, reason, created_at')
      .eq('enquiry_id', enquiryId)
      .order('created_at')

    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      actorType: row.actor_type,
      reason: row.reason,
      createdAt: row.created_at,
    }))
  } catch (error) {
    logError('dal.getEnquiryTimeline', error, { enquiryId })
    return []
  }
}

export interface ShortlistRow {
  vendorId: string
  vendorName: string
  vendorSlug: string
  cityName: string | null
  categoryName: string | null
  ratingAverage: number
  ratingCount: number
  coverPath: string | null
  note: string | null
  createdAt: string
}

export async function getShortlist(): Promise<ShortlistRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('shortlists')
      .select(
        `vendor_id, note, created_at,
         vendors(display_name, slug, rating_average, rating_count,
                 cities(name),
                 vendor_categories(is_primary, categories(name)),
                 vendor_media(storage_path, is_cover, moderation_status))`,
      )
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? [])
      .filter((row) => row.vendors)
      .map((row) => {
        const vendor = row.vendors!
        const media = (vendor.vendor_media ?? []).filter((m) => m.moderation_status === 'approved')
        const cover = media.find((m) => m.is_cover) ?? media[0]
        return {
          vendorId: row.vendor_id,
          vendorName: vendor.display_name,
          vendorSlug: vendor.slug,
          cityName: vendor.cities?.name ?? null,
          categoryName:
            vendor.vendor_categories?.find((c) => c.is_primary)?.categories?.name ?? null,
          ratingAverage: Number(vendor.rating_average ?? 0),
          ratingCount: Number(vendor.rating_count ?? 0),
          coverPath: cover?.storage_path ?? null,
          note: row.note,
          createdAt: row.created_at,
        }
      })
  } catch (error) {
    logError('dal.getShortlist', error)
    return []
  }
}

/**
 * Every vendor the signed-in customer has saved, for rendering save buttons
 * across a list of cards in one round trip instead of one query per card.
 *
 * RLS scopes `shortlists` to the caller, so a signed-out visitor gets an empty
 * set from the same query rather than a special case here.
 */
export async function getShortlistedVendorIds(): Promise<Set<string>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('shortlists').select('vendor_id')
    if (error) throw error
    return new Set((data ?? []).map((row) => row.vendor_id))
  } catch (error) {
    logError('dal.getShortlistedVendorIds', error)
    return new Set()
  }
}

export async function isShortlisted(vendorId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('shortlists')
      .select('id')
      .eq('vendor_id', vendorId)
      .maybeSingle()
    return Boolean(data)
  } catch {
    return false
  }
}

export async function getWeddingProfile() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('wedding_profiles')
      .select(
        'id, display_label, wedding_date, flexible_month, primary_city_id, budget_min_minor, budget_max_minor, guest_count, notes, wedding_required_categories(category_id)',
      )
      .maybeSingle()
    if (error) throw error
    return data
  } catch (error) {
    logError('dal.getWeddingProfile', error)
    return null
  }
}

export interface NotificationRow {
  id: string
  code: string
  payload: Record<string, unknown>
  createdAt: string
  readAt: string | null
}

export async function getNotifications(limit = 50): Promise<NotificationRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('notifications')
      .select('id, code, payload_json, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      payload: (row.payload_json ?? {}) as Record<string, unknown>,
      createdAt: row.created_at,
      readAt: row.read_at,
    }))
  } catch (error) {
    logError('dal.getNotifications', error)
    return []
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const supabase = await createClient()
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
    return count ?? 0
  } catch {
    return 0
  }
}

/** Vendor-side inbox. Minimal for now; the full CRM is Milestone 5. */
export async function getVendorEnquiries(vendorId: string): Promise<EnquiryListRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('enquiries')
      .select(
        `id, status, created_at, event_date, guest_count, message,
         vendors(display_name, slug), categories(name),
         conversations(messages(created_at, read_at, sender_user_id))`,
      )
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const {
      data: { user },
    } = await supabase.auth.getUser()

    return (data ?? []).map((row) => {
      const conversation = Array.isArray(row.conversations)
        ? row.conversations[0]
        : row.conversations
      const messages = (conversation?.messages ?? []) as ThreadMessage[]
      return {
        id: row.id,
        status: row.status as EnquiryStatus,
        createdAt: row.created_at,
        eventDate: row.event_date,
        guestCount: row.guest_count,
        message: row.message,
        vendorName: row.vendors?.display_name ?? '',
        vendorSlug: row.vendors?.slug ?? '',
        categoryName: row.categories?.name ?? null,
        unreadCount: messages.filter((m) => !m.read_at && m.sender_user_id !== user?.id).length,
        lastMessageAt:
          messages.length > 0
            ? messages
                .map((m) => m.created_at)
                .sort()
                .slice(-1)[0]
            : null,
      }
    })
  } catch (error) {
    logError('dal.getVendorEnquiries', error, { vendorId })
    return []
  }
}

/**
 * Customer contact details, released only with consent (PRD 2.3, 6.6 — a
 * vendor must not see customer PII before consent).
 */
export async function getCustomerContact(enquiryId: string) {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('enquiries')
      .select('contact_consent, profiles!enquiries_customer_id_fkey(full_name, phone)')
      .eq('id', enquiryId)
      .maybeSingle()

    if (!data?.contact_consent) return null
    return { fullName: data.profiles?.full_name ?? null, phone: data.profiles?.phone ?? null }
  } catch (error) {
    logError('dal.getCustomerContact', error, { enquiryId })
    return null
  }
}
