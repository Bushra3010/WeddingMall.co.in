/**
 * Telling the Android shell apart from a browser.
 *
 * Capacitor appends `NATIVE_UA_MARKER` to the WebView's user agent (see
 * `capacitor.config.ts`), which is the only signal available before a page has
 * rendered — and the proxy has to decide before that.
 *
 * ## This is product scope, not a security boundary
 *
 * A user agent is a request header. Anyone can send it, and anyone can remove
 * it. Nothing here decides what a person is *allowed* to do — it decides what
 * the mobile app *offers*, which is the brief: the app carries the customer and
 * vendor flows, and the admin workspace stays on the web.
 *
 * Admin authorisation is unchanged and unaffected: `requireAdmin` in
 * `server/policies/require.ts` still runs, every mutation still re-checks with
 * `assertPermission`, and RLS still refuses the rows. Someone who strips this
 * header out of curiosity reaches the same login and the same policies they
 * would reach in a browser. If admin access from a phone ever needs to be
 * genuinely impossible, that belongs in the permission catalogue and RLS, not
 * in a string comparison here.
 */

/** Appended to the WebView user agent by Capacitor. */
export const NATIVE_UA_MARKER = 'WeddingMallApp'

/** Routes the mobile app does not carry. */
const WEB_ONLY_PREFIXES = ['/admin']

/** Where the app sends someone who follows an admin link into it. */
export const WEB_ONLY_NOTICE_PATH = '/app/web-only'

export function isNativeApp(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && userAgent.includes(NATIVE_UA_MARKER))
}

export function isWebOnlyPath(pathname: string): boolean {
  return WEB_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
