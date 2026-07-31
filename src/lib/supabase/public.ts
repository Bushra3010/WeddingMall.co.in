import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { env } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Cookie-free anon client for genuinely public data (taxonomy, published
 * listings, approved reviews).
 *
 * Why this exists: `lib/supabase/server.ts` reads cookies, and touching cookies
 * opts a route out of static rendering. Public discovery pages are supposed to
 * be cached and revalidated after moderation (PRD 8.3), so they must not read
 * the session at all.
 *
 * It carries the publishable key and no session, so every query runs as `anon`
 * and RLS still applies — this grants nothing a logged-out visitor lacks.
 * Anything user-specific must use the request-scoped client instead.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
