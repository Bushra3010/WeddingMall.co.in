import { NextResponse, type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PREFIXES = ['/account', '/vendor-dashboard', '/admin']

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  if (needsAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/sign-in'
    url.search = `?next=${encodeURIComponent(pathname + search)}`
    const redirectResponse = NextResponse.redirect(url)
    // Carry the refreshed session cookies onto the redirect.
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie)
    }
    // The redirect is part of the private area, so it carries the same
    // directive as the page would have (PRD 11.1).
    redirectResponse.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return redirectResponse
  }

  // Dashboards must never be indexed (PRD 11.1).
  if (needsAuth) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Auth cookie refresh has
     * to run broadly so Server Components always see a fresh session.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}
