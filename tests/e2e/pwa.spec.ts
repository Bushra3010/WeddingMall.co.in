import { expect, test } from '@playwright/test'

import { NATIVE_UA_MARKER } from '../../src/lib/native'

/**
 * PWA manifest and the app-only routing rules.
 *
 * The service worker itself is not exercised here: it registers only in a
 * production build (see `components/pwa/service-worker.tsx` for why), and this
 * suite runs against `npm run dev`. Its behaviour was verified against
 * `npm run build && npm start` — only `/_next/static/**` and `/offline` in the
 * caches, no HTML at all — and the thing that keeps it honest is the design,
 * not a test that cannot run: nothing in the worker has a branch that stores a
 * document.
 *
 * What is tested here is what the dev server can prove, and what would
 * silently rot otherwise: the manifest a browser reads before offering to
 * install, and the routing that keeps the admin workspace off the phone.
 */

test('the manifest is installable and describes the app the brief asked for', async ({
  request,
}) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.status()).toBe(200)

  const manifest = await response.json()

  expect(manifest.name).toBe('WEDDING MALL')
  expect(manifest.short_name).toBe('WEDDING MALL')
  // Without `standalone` an installed copy opens in a browser tab with an
  // address bar, which is the difference between an app and a bookmark.
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toContain('/')

  // Chrome will not offer to install without a 192 and a 512.
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes)
  expect(sizes).toContain('192x192')
  expect(sizes).toContain('512x512')

  // Android crops icons to a circle or squircle; without a maskable variant
  // the mark is letterboxed inside a white blob.
  const maskable = manifest.icons.filter(
    (icon: { purpose?: string }) => icon.purpose === 'maskable',
  )
  expect(maskable.length).toBeGreaterThanOrEqual(2)

  // The admin workspace is web-only, so it must not be advertised as a
  // shortcut into the installed app.
  const shortcutUrls = (manifest.shortcuts ?? []).map((s: { url: string }) => s.url)
  expect(shortcutUrls.every((url: string) => !url.startsWith('/admin'))).toBe(true)
})

test('every manifest icon actually resolves', async ({ request }) => {
  // A manifest listing an icon that 404s fails installation with a message
  // that names neither the icon nor the manifest.
  const manifest = await (await request.get('/manifest.webmanifest')).json()

  for (const icon of manifest.icons as { src: string }[]) {
    const response = await request.get(icon.src)
    expect(response.status(), `${icon.src} should resolve`).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')
  }
})

test('the offline fallback renders on its own', async ({ page }) => {
  // Precached at install time, so it has to be a page that never needed a
  // request. If it ever gains a dynamic dependency this fails here rather than
  // on someone's phone in a tunnel.
  await page.goto('/offline')
  await expect(page.getByRole('heading', { name: 'You are offline' })).toBeVisible()
})

/*
 * Both platforms, because the marker was once declared under `android` only in
 * `capacitor.config.ts` — Android passed, and iOS would have shipped serving
 * the admin workspace inside the app.
 */
const APP_USER_AGENTS = {
  Android: `Mozilla/5.0 (Linux; Android 14; Pixel 6) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36 ${NATIVE_UA_MARKER}`,
  iOS: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ${NATIVE_UA_MARKER}`,
} as const

for (const [platform, userAgent] of Object.entries(APP_USER_AGENTS)) {
  test.describe(`inside the ${platform} app`, () => {
    test.use({ userAgent })

    test('an admin route redirects to the web-only notice', async ({ page }) => {
      await page.goto('/admin')

      await expect(page).toHaveURL(/\/app\/web-only$/)
      await expect(page.getByRole('heading', { name: 'Admin is on the web' })).toBeVisible()
    })

    test('customer and vendor routes are still reachable', async ({ page }) => {
      /*
       * The other half of the assertion above. A rule that blocked everything
       * would pass "admin is blocked" while making the app useless, which is
       * the failure mode a one-sided test invites.
       *
       * Signed out, both redirect to sign-in — the point is that they reach
       * the auth flow rather than the web-only notice.
       */
      for (const route of ['/account', '/vendor-dashboard']) {
        await page.goto(route)
        await expect(page).toHaveURL(/\/auth\/sign-in/)
      }

      await page.goto('/vendors')
      await expect(page).toHaveURL(/\/vendors$/)
    })
  })
}

test('a browser reaches admin normally', async ({ page }) => {
  // Confirms the block is scoped to the app user agent and has not quietly
  // become a site-wide redirect.
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/auth\/sign-in/)
})
