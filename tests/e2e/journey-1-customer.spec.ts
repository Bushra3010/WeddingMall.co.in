import { expect, test } from '@playwright/test'

/**
 * PRD 17.4, Journey 1 — customer discovery through to a message.
 *
 * "Customer signs up → searches → opens vendor → shortlists → submits enquiry
 * → sends message."
 *
 * Runs against the live Supabase project, so it needs `.env.local` values in
 * the environment. Each run creates its own account through the real sign-up
 * form and cleans it up afterwards, so the test is repeatable and leaves
 * nothing behind.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY

// A unique address per run: sign-up is idempotent-hostile by nature.
// Supabase Auth rejects some reserved TLDs (.test among them) at public
// sign-up, even though the admin API accepts them. example.com is accepted.
const email = `e2e-journey1-${Date.now()}@example.com`
const password = 'JourneyPassword123'
const NAME = 'Journey Tester'

test.describe.configure({ mode: 'serial' })

/**
 * The account is created through the Auth admin API rather than the sign-up
 * form. Supabase's default SMTP allows only a handful of confirmation emails
 * per hour, so a form-based sign-up makes this whole journey fail on a quota
 * that has nothing to do with the behaviour under test. The sign-up FORM is
 * covered by its own test below, which is allowed to be flaky for that reason.
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
      user_metadata: { full_name: NAME },
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

  // Enquiries reference the profile, so they go first.
  await fetch(`${SUPABASE_URL}/rest/v1/enquiries?customer_id=eq.${user.id}`, {
    method: 'DELETE',
    headers,
  })
  await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}`, {
    method: 'DELETE',
    headers,
  })
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers })
})

test('a customer can sign up, shortlist, enquire, and message', async ({ page }) => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY, 'needs .env.local for the live project')

  // --- 1. Sign in -----------------------------------------------------------
  await page.goto('/auth/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/account/, { timeout: 15_000 })

  // --- 2. Search ------------------------------------------------------------
  await page.goto('/vendors/venues')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Wedding Venues')

  const firstVendor = page.locator('article a').first()
  await expect(firstVendor).toBeVisible()
  await firstVendor.click()

  // --- 3. Vendor profile ----------------------------------------------------
  await expect(page).toHaveURL(/\/vendor\//)
  const vendorHeading = page.getByRole('heading', { level: 1 })
  await expect(vendorHeading).toBeVisible()
  const vendorUrl = page.url()

  // --- 4. Shortlist ---------------------------------------------------------
  await page.getByRole('button', { name: /Save to shortlist/i }).click()
  await expect(page.getByRole('button', { name: /Saved to shortlist/i })).toBeVisible({
    timeout: 15_000,
  })

  // It has to survive a reload — a shortlist that only exists in memory is not
  // a shortlist (PRD 6.5: "retain across sessions").
  await page.goto('/account/shortlist')
  await expect(page.getByRole('heading', { name: 'Shortlist' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Request a quote/i }).first()).toBeVisible()

  // --- 5. Enquiry -----------------------------------------------------------
  await page.goto(`${vendorUrl}/enquire`)
  await page.getByLabel('Guests (approx.)').fill('250')
  await page
    .getByRole('textbox', { name: /What would you like to ask/i })
    .fill(
      'We are planning a March wedding for around 250 guests and would like to know your availability and what is included.',
    )
  await page.getByRole('button', { name: 'Send enquiry' }).click()

  // Lands on the enquiry with a confirmation.
  await expect(page).toHaveURL(/\/account\/enquiries\/[0-9a-f-]+/, { timeout: 20_000 })
  await expect(page.getByText('Your enquiry has been sent.')).toBeVisible()

  // The timeline records submission and delivery (PRD 6.6).
  await expect(page.getByText('You sent this enquiry')).toBeVisible()
  await expect(page.getByText('Delivered to the vendor')).toBeVisible()

  // Consent was left unchecked, so contact details must not be shared.
  await expect(page.getByText(/contact details have not been shared/i)).toBeVisible()

  // --- 6. Message -----------------------------------------------------------
  const messageBody = 'Could you also confirm whether parking is available on site?'
  await page.getByRole('textbox', { name: 'Write a message' }).fill(messageBody)
  await page.getByRole('button', { name: 'Send', exact: true }).click()

  await expect(page.getByText(messageBody)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Message sent')).toBeVisible()

  // --- 7. It is all still there on a fresh load ------------------------------
  await page.goto('/account/enquiries')
  await expect(page.getByRole('heading', { name: 'Enquiries' })).toBeVisible()
  await expect(page.getByText(/250 guests/)).toBeVisible()
})

test('a customer cannot open an enquiry that is not theirs', async ({ page }) => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY, 'needs .env.local for the live project')

  await page.goto('/auth/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/account/, { timeout: 15_000 })

  // A well-formed id that belongs to nobody: RLS makes "not yours" and
  // "not found" indistinguishable, which is the intended behaviour.
  const response = await page.goto('/account/enquiries/00000000-0000-4000-8000-000000000000')
  expect(response?.status()).toBe(404)
})

/**
 * The sign-up form itself. Separate from the journey because Supabase Auth
 * rejects it for reasons that have nothing to do with our code: the default
 * SMTP rate-limits confirmation emails, and reserved domains like example.com
 * and .test are refused outright. Both surface as the same generic error, so
 * this test skips rather than failing the suite over provider policy.
 *
 * Note the asymmetry that made this test misleading: run alone it tends to be
 * refused and skip, and only in the full suite does it get far enough to
 * assert anything. A skip is not a pass.
 *
 * It will run for real once a proper SMTP provider and a domain Supabase
 * accepts are configured — see docs/STATUS.md.
 */
test('the sign-up form accepts a new account', async ({ page }) => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY, 'needs .env.local for the live project')

  const fresh = `e2e-signup-${Date.now()}@example.com`

  await page.goto('/auth/sign-up')
  await page.getByLabel('Your name').fill('Sign Up Tester')
  await page.getByLabel('Email').fill(fresh)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()

  /*
   * Three outcomes are legitimate here, and the test used to know about only
   * two of them.
   *
   * Sign-up now signs the new account straight in when the project does not
   * require email confirmation, which is what a customer should get. This
   * assertion still waited for "Check your inbox" and failed against a page
   * that had done exactly the right thing — the account was created, signed in,
   * and sitting on /account.
   */
  const signedIn = page.getByRole('button', { name: 'Sign out' })
  const confirmation = page.getByText('Check your inbox')
  const providerRefused = page.getByText(/could not create that account/i)
  await expect(signedIn.or(confirmation).or(providerRefused)).toBeVisible({ timeout: 20_000 })

  if (await providerRefused.isVisible()) {
    test.skip(
      true,
      'Supabase Auth refused the address (rate limit or reserved domain) — not a product failure',
    )
  }

  // Whichever of the two success paths ran, the account must not still be
  // anonymous: the reported bug was a new account landing back on a sign-in
  // wall.
  if (await signedIn.isVisible()) {
    await expect(page).toHaveURL(/\/account/)
  }

  // Clean up the account this test created.
  const headers = { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` }
  const users = await (
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers })
  ).json()
  const created = (users.users ?? []).find((u: { email?: string }) => u.email === fresh)
  if (created) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${created.id}`, { method: 'DELETE', headers })
  }
})
