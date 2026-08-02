/**
 * Content Security Policy (PRD 10.3).
 *
 * ## Why there is no nonce, and what that costs
 *
 * The strong form of a CSP for Next is `'nonce-…' 'strict-dynamic'`: trust the
 * bootstrap script by nonce, trust whatever it loads, ignore host allow-lists.
 * Next threads that nonce onto its own scripts only when the root layout reads
 * it from `headers()`.
 *
 * Reading a header in the root layout opts the **entire route tree** out of
 * static rendering. Measured on this app: static routes fell from 12 to 2, and
 * `/` went back to being a function invocation — undoing the work in ADR-030
 * that took TTFB from ~950ms to ~150ms for Indian traffic.
 *
 * Worse, it is not a free choice either way. With `strict-dynamic` in force, a
 * statically prerendered page carries no nonce on its inline bootstrap, so the
 * browser blocks it and the page renders blank. Nonce and static rendering are
 * mutually exclusive here, not merely in tension.
 *
 * **Decision:** enforce every directive that does not require a nonce, and
 * accept `'unsafe-inline'` on `script-src`. This is a genuine weakness and is
 * recorded as a launch blocker in STATUS.md rather than dressed up: it means a
 * successful HTML injection could run script. What the policy still buys is
 * substantial and is not theatre —
 *
 *   * `object-src 'none'` kills plugin-based execution;
 *   * `base-uri 'self'` stops `<base>` injection redirecting every relative
 *     URL, a common way to turn a small injection into total script control;
 *   * `frame-ancestors 'none'` is the clickjacking control modern browsers
 *     honour (`X-Frame-Options` is the legacy fallback);
 *   * `form-action 'self'` stops an injected form posting credentials offsite;
 *   * `default-src 'self'` closes every fetch destination not named below.
 *
 * The route out is Partial Prerendering: once the dynamic hole can carry a
 * nonce while the shell stays static, this becomes nonce + `strict-dynamic`
 * with no latency cost. That is the follow-up noted in STATUS.md.
 */
export function buildCsp(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'script-src': [
      "'self'",
      // See the note above. Required by Next's inline bootstrap on statically
      // rendered pages, which have no request and therefore no nonce.
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
