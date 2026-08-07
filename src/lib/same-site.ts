/**
 * Is a URL part of this site, allowing for the `www`?
 *
 * Written because a strict `origin ===` comparison shipped a broken APK.
 * `weddingmall.co.in` 308-redirects to `www.weddingmall.co.in`, so the two
 * spellings are one site that origin equality calls two. In the Android shell
 * that meant every link written without the `www` — in vendor copy, in an
 * email, in a seeded row — was treated as somebody else's website and opened
 * outside the app.
 *
 * The protocol is still compared exactly. Treating `http://` and `https://` as
 * the same site would let a downgraded link stay inside the WebView carrying
 * the session with it.
 */
export function isSameSite(target: URL, current: URL): boolean {
  const bare = (host: string) => host.replace(/^www\./i, '')
  return target.protocol === current.protocol && bare(target.host) === bare(current.host)
}
