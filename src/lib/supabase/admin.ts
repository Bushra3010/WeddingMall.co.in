import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { env, serverEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Service-role client. BYPASSES RLS.
 *
 * Permitted callers: cron Route Handlers, payment webhooks, and background jobs
 * under `src/server/jobs`. Never import this from a Server Component, a Server
 * Action reachable from the UI, or anything under `src/components` (PRD 10.1).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
