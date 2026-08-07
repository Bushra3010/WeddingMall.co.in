import type { MetadataRoute } from 'next'

/**
 * Web app manifest (served at /manifest.webmanifest).
 *
 * `display: standalone` is what makes an installed copy open without browser
 * chrome, and it is also what the Capacitor Android shell mirrors.
 *
 * `start_url` carries `?source=pwa` so installed traffic is distinguishable in
 * analytics from a normal visit — the same URL otherwise, so nothing about the
 * app is a separate code path.
 *
 * Deliberately **not** listed here: anything under /admin. The admin workspace
 * is web-only, so it gets no shortcut, no scope of its own, and no share
 * target. See `lib/native.ts` for the routing side of that.
 */
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WEDDING MALL',
    short_name: 'WEDDING MALL',
    description: 'Find trusted wedding professionals, compare options, and plan confidently.',
    id: '/',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    // brand-900, matching the `themeColor` in the root layout. A mismatch shows
    // as a flash of the wrong colour in the status bar on launch.
    theme_color: '#460c07',
    background_color: '#fdf9f1',
    categories: ['shopping', 'lifestyle'],
    lang: 'en-IN',
    dir: 'ltr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      /*
       * Android crops an icon to a circle or squircle depending on the
       * launcher. A `maskable` variant keeps the mark inside the safe zone so
       * it is not clipped; without one, Android letterboxes the `any` icon
       * inside a white blob.
       */
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Browse vendors', url: '/vendors' },
      { name: 'My shortlist', url: '/account/shortlist' },
      { name: 'My enquiries', url: '/account/enquiries' },
    ],
  }
}
