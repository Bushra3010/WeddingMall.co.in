import { createBrowserClient } from '@supabase/ssr'

import { env } from '@/lib/env'
import type { Database } from '@/types/database'

/** Browser client. Only ever receives the publishable key (PRD 10.1). */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}
