/**
 * Content Security Policy (PRD 10.3).
 *
 * ## How the nonce actually gets applied
 *
 * Next reads the nonce from the **incoming request's** `content-security-policy`
 * header (`app-render.js`: `headers['content-security-policy']`), not from a
 * `headers()` call in the root layout. So the proxy sets the policy on the
 * request as well as the response, and Next stamps the nonce onto its own
 * bootstrap and chunk-loading script tags.
 *
 * This matters because it is the opposite of what this file used to claim.
 * ADR-034 recorded that a nonce required reading `headers()` in the root
 * layout — which does force the whole tree dynamic, measured at the time as
 * static routes falling from 12 to 2 — and concluded the fix had to wait for
 * Partial Prerendering. That was wrong. Nothing had to wait, and PPR would not
 * have helped: a prerendered shell is built without a request, so it cannot
 * carry a request-specific nonce no matter how the rest of the page streams.
 *
 * ## Why only some routes get a nonce
 *
 * A nonce is only meaningful on a response Next actually renders per request.
 * A prerendered page was built without one, so its scripts carry no nonce and
 * a nonce-only policy would block them — a blank page.
 *
 * So dynamic routes (everything behind a login, plus search and vendor
 * profiles, which render user-supplied text) get `'nonce-…' 'strict-dynamic'`.
 * Browsers that understand `strict-dynamic` ignore `'unsafe-inline'` and
 * `'self'` entirely on those routes, which is the strong policy. Prerendered
 * public pages keep `'unsafe-inline'`.
 *
 * That leaves the weaker policy exactly where the content is ours and static,
 * and the strong one where sessions and user-supplied text live.
 *
 * The other directives apply everywhere and are not decoration:
 * `object-src 'none'` kills plugin execution, `base-uri 'self'` stops `<base>`
 * injection turning a small injection into total script control,
 * `frame-ancestors 'none'` is the clickjacking control modern browsers honour,
 * and `form-action 'self'` stops an injected form posting credentials offsite.
 */
export function buildCsp(isDev: boolean, nonce?: string): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'script-src': [
      "'self'",
      ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : []),
      // Ignored by any browser that understands the nonce above; required on
      // prerendered pages, which have no request and therefore no nonce.
      "'unsafe-inline'",
      // Dev only: Turbopack's HMR client evaluates code at runtime.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Next inlines critical CSS and React writes `style` attributes.
    'style-src': ["'self'", "'unsafe-inline'"],
    // `https:` rather than the Supabase host alone: vendor media may later be
    // served from a CDN, and a policy that breaks on the first CDN switch gets
    // loosened in a hurry rather than thought about.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'https:', 'wss:', ...(isDev ? ['ws:'] : [])],
    'media-src': ["'self'", 'https:'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  }

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')

  // Pointless on localhost; harmless in production, where all traffic is TLS.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`
}

/**
 * A fresh nonce per request.
 *
 * `crypto.getRandomValues` rather than `node:crypto` because the proxy runs on
 * the edge runtime, where `Buffer` is not guaranteed to exist.
 */
export function newNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
