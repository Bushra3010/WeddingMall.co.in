import { env } from '@/lib/env'

/**
 * Public bucket URL builder. Private buckets (`vendor-documents`,
 * `message-attachments`) must never be linked this way — issue a short-lived
 * signed URL from a server service after a permission check (PRD 10.1).
 */
export function storagePublicUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, '')}`
}

export const PUBLIC_BUCKETS = ['vendor-media', 'review-media'] as const
export const PRIVATE_BUCKETS = ['vendor-documents', 'message-attachments'] as const
