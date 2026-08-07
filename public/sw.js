/* global self, caches, fetch, Request, Response, URL */

/**
 * WEDDING MALL service worker.
 *
 * The brief was explicit: site updates must appear immediately, no aggressive
 * caching, never show stale content. That rules out the usual "cache the app
 * shell and serve it first" pattern, so this worker does the opposite of what
 * most PWA templates do.
 *
 * ## What is cached, and why only this
 *
 * Only `/_next/static/**` and the offline page. Next fingerprints every file
 * under `/_next/static` with a content hash, so the URL changes the moment the
 * content does — the cache invalidates itself and can never go stale. That is
 * the one place cache-first is both safe and worth having, and it is where the
 * bulk of the bytes are.
 *
 * ## What is deliberately NOT cached
 *
 * **HTML.** Not one page, not even briefly. Two reasons, either sufficient:
 * every page here renders per request, so a cached copy is stale the moment a
 * vendor edits a listing; and pages under /account, /vendor-dashboard and
 * /admin are rendered for one signed-in person. A cache is not partitioned by
 * session, so storing those risks handing one account's page to whoever opens
 * the app next. The offline page is a fallback for a failed navigation, never
 * a substitute for a live one.
 *
 * **Anything that is not a same-origin GET.** Server Actions are POSTs; an
 * intercepted or replayed mutation is worse than a slow one. Supabase calls are
 * cross-origin and carry auth. Both pass straight through, untouched.
 *
 * **RSC payloads** (`?_rsc=`), which are the client-side navigation equivalent
 * of HTML and go stale exactly as fast.
 *
 * ## Taking over immediately
 *
 * `skipWaiting` + `clients.claim` means a new worker replaces the old one on
 * the next load rather than waiting for every tab to close. Combined with
 * deleting non-current caches on activate, a deploy cannot leave someone on
 * yesterday's assets.
 */

const VERSION = 'v1'
const STATIC_CACHE = `wm-static-${VERSION}`
const OFFLINE_CACHE = `wm-offline-${VERSION}`
const OFFLINE_URL = '/offline'
const CURRENT_CACHES = [STATIC_CACHE, OFFLINE_CACHE]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE)
      // `reload` so installing a new worker cannot pick the offline page up
      // from the HTTP cache and pin an old copy of it.
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => !CURRENT_CACHES.includes(name)).map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

/**
 * Lets the page tell a waiting worker to activate now, and provides a way out:
 * `UNREGISTER` drops every cache and removes the worker, so a bad release can
 * be recovered from the page rather than by asking people to clear site data.
 */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
  if (event.data === 'UNREGISTER') {
    event.waitUntil(
      (async () => {
        const names = await caches.keys()
        await Promise.all(names.map((name) => caches.delete(name)))
        await self.registration.unregister()
      })(),
    )
  }
})

/** Immutable, content-hashed build output — the only safe cache-first target. */
function isHashedAsset(url) {
  return url.pathname.startsWith('/_next/static/')
}

/** A client-side navigation payload: as perishable as the HTML it replaces. */
function isRscRequest(request, url) {
  return url.searchParams.has('_rsc') || request.headers.get('RSC') === '1'
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Mutations, cross-origin calls, and range requests are none of this
  // worker's business. Returning without calling `respondWith` leaves the
  // browser to handle them exactly as it would with no worker installed.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.headers.has('range')) return
  if (isRscRequest(request, url)) return

  if (isHashedAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkOnlyWithOfflineFallback(request))
    return
  }

  // Everything else — images, fonts served from /public, JSON — goes to the
  // network. No fallback: an image that fails should fail, not resurrect a
  // version the vendor replaced.
})

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit

  const response = await fetch(request)
  // Opaque and error responses are never stored; caching a 404 for an
  // immutable URL would persist until the next deploy.
  if (response.ok && response.type === 'basic') {
    cache.put(request, response.clone())
  }
  return response
}

async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(OFFLINE_CACHE)
    const offline = await cache.match(OFFLINE_URL)
    return (
      offline ??
      new Response('You are offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    )
  }
}
