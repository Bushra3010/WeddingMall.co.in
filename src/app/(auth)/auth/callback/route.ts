import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { safeRedirect } from '@/features/auth/schema'
import { logError } from '@/lib/observability/logger'

/**
 * PKCE / email-confirmation callback. Route Handler rather than a Server Action
 * because the provider redirects here with a `code` in the query string
 * (PRD 8.3).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = safeRedirect(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=missing_code`)
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    return NextResponse.redirect(`${origin}${next}`)
  } catch (error) {
    logError('auth.callback', error)
    return NextResponse.redirect(`${origin}/auth/sign-in?error=exchange_failed`)
  }
}
