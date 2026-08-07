import { NextResponse, type NextRequest } from 'next/server'

import { isNativeApp, isWebOnlyPath, WEB_ONLY_NOTICE_PATH } from '@/lib/native'
import { buildCsp, newNonce } from '@/lib/security/csp'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PREFIXES = ['/account', '/vendor-dashboard', '/admin']

/**
 * Routes that render per request, and can therefore carry a nonce.
 *
 * These are also the surfaces worth protecting most: everything behind a
 * login, plus search and vendor profiles, which render user-supplied text.
 */
const DYNAMIC_PREFIXES = ['/account', '/vendor-dashboard', '/admin', '/auth', '/vendors', '/vendor']

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  /*
   * Next extracts the nonce from the *request's* `content-security-policy`
   * header (see `app-render.js`), not from `headers()` in a layout — so a
   * nonce costs nothing in static rendering, which is the opposite of what
   * ADR-034 originally assumed.
   *
   * It only lands on scripts for routes that actually render per request. A
   * prerendered page was built without a request and carries no nonce, so its
   * policy has to keep `'unsafe-inline'` — which is why the nonce is added
   * only for the dynamic surfaces below.
   */
  const nonce = DYNAMIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    ? newNonce()
    : undefined
  const csp = buildCsp(process.env.NODE_ENV !== 'production', nonce)

  if (nonce) request.headers.set('content-security-policy', csp)
  response.headers.set('content-security-policy', csp)

  /*
   * The mobile app carries the customer and vendor flows only, so an admin
   * link followed inside it lands on an explanation rather than a workspace
   * built for a wide table.
   *
   * Routing, not authorisation. The marker is a user-agent string and is
   * trivially removable; `requireAdmin`, `assertPermission` and RLS are what
   * actually decide who may read or write an admin row, and none of them are
   * touched by this. See `lib/native.ts`.
   */
  if (isWebOnlyPath(pathname) && isNativeApp(request.headers.get('user-agent'))) {
    const url = request.nextUrl.clone()
    url.pathname = WEB_ONLY_NOTICE_PATH
    url.search = ''
    const notice = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) notice.cookies.set(cookie)
    notice.headers.set('X-Robots-Tag', 'noindex, nofollow')
    notice.headers.set('content-security-policy', csp)
    return notice
  }

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
    redirectResponse.headers.set('content-security-policy', csp)
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
