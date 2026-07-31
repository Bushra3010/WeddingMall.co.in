import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Refreshes the Supabase session cookie on every matched request so that Server
 * Components always observe a valid session. Returns both the user and the
 * response whose cookies must be propagated.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Must be getUser(), not getSession(): only getUser() revalidates the JWT
  // against the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user, supabase }
}
