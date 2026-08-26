import { expect, test } from '@playwright/test'

/**
 * The customer and vendor workspaces on a phone (PRD 7.4).
 *
 * Both shipped wider than the viewport: the section nav is a grid item, and a
 * grid item's default `min-width: auto` refuses to shrink below its content, so
 * fourteen vendor links forced the document to 1237px. The browser then zoomed
 * the page out to fit, which is why the header looked like it covered only part
 * of the screen — it was correctly 390px wide on a page that had become 1237px.
 *
 * The homepage has had a "does not scroll sideways" assertion since the mobile
 * work; these two routes did not, which is the whole reason this reached
 * production. The gap is closed here rather than by widening the homepage test,
 * because the failure was in the shell these routes share and nothing else uses.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY

const email = `e2e-dashboard-${Date.now()}@example.com`
const password = 'DashboardPassword123'

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})

test.describe.configure({ mode: 'serial' })

/*
 * Created through the Auth admin API rather than the sign-up form: Supabase's
 * default SMTP allows only a few confirmation emails an hour, and a layout
 * assertion should not fail on an email quota.
 */
test.beforeAll(async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) return
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Dashboard Tester' },
    }),
  })
})

test.afterAll(async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) return
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  const users = await (
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers })
  ).json()
  const user = (users.users ?? []).find((u: { email?: string }) => u.email === email)
  if (!user) return

  /*
   * Opening the listing wizard creates a vendor for a user who has none, so
   * this suite leaves a business behind unless it clears up after itself.
   * Everything hanging off `vendors` is `on delete cascade`, so the parent row
   * is the only delete needed — but the membership has to be read first, since
   * deleting the user takes the row that points at the vendor with it.
   */
  const rest = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }
  const memberships = await (
    await fetch(
      `${SUPABASE_URL}/rest/v1/vendor_memberships?user_id=eq.${user.id}&select=vendor_id`,
      {
        headers: rest,
      },
    )
  ).json()

  for (const { vendor_id } of (memberships ?? []) as { vendor_id: string }[]) {
    await fetch(`${SUPABASE_URL}/rest/v1/vendors?id=eq.${vendor_id}`, {
      method: 'DELETE',
      headers: rest,
    })
  }

  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers })
})

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/auth/sign-in')
  await page.getByLabel(/email/i).first().fill(email)
  await page
    .getByLabel(/password/i)
    .first()
    .fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'), { timeout: 15_000 })
}

/*
 * `/vendor-dashboard/list` is included deliberately.
 *
 * The onboarding wizard's mobile step rail is seven pills wider than a phone,
 * and Chrome sizes the mobile layout viewport from a descendant's scrollable
 * content — so a rail that was scrolling correctly inside its own box still
 * stretched `innerWidth` to 461 and rendered the entire dashboard zoomed out.
 * The old list here stopped at `/vendor-dashboard`, which does not overflow,
 * so nothing caught it.
 */
for (const route of ['/account', '/vendor-dashboard', '/vendor-dashboard/list']) {
  test(`${route} fits the viewport on a phone`, async ({ page }) => {
    test.skip(!SUPABASE_URL || !SERVICE_KEY, 'needs .env.local for the live project')
    await signIn(page)
    await page.goto(route)

    /*
     * Measured as three separate facts, because they fail differently.
     * `innerWidth` catches the layout viewport being stretched — the symptom
     * that made the header look broken — and it is the one a document-width
     * check alone would miss, since the document dutifully matches the
     * stretched viewport.
     */
    const layout = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      headerWidth: Math.round(document.querySelector('header')!.getBoundingClientRect().width),
    }))

    expect(layout.innerWidth).toBe(390)
    expect(layout.documentWidth).toBeLessThanOrEqual(390)
    // The header spanning less than the screen is exactly what was reported.
    expect(layout.headerWidth).toBe(390)
  })
}

test('the section nav scrolls inside itself and marks where you are', async ({ page }) => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY, 'needs .env.local for the live project')
  await signIn(page)
  await page.goto('/account/enquiries')

  const nav = page.getByRole('navigation', { name: 'Account' })

  // Scrollable within its own box is the point: the links must overflow
  // *somewhere*, and the correct somewhere is here rather than the document.
  const scrolls = await nav.locator('ul').evaluate((el) => el.scrollWidth > el.clientWidth)
  expect(scrolls).toBe(true)

  // Landing on a section the strip has scrolled past leaves nothing to orient
  // by unless the current one is marked.
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Enquiries')
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
})
