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

    // If the user has a vendor, send them to the listing wizard; otherwise to onboarding
    const { data: memberships } = await supabase
      .from('vendor_memberships')
      .select('vendor_id')
      .limit(1)

    const vendorNext = memberships && memberships.length > 0
      ? '/vendor-dashboard/list'
      : next

    return NextResponse.redirect(`${origin}${vendorNext}`)
  } catch (error) {
    logError('auth.callback', error)
    return NextResponse.redirect(`${origin}/auth/sign-in?error=exchange_failed`)
  }
}
