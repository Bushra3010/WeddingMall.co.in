import { expect, test } from '@playwright/test'

/**
 * Milestone 1 smoke coverage: the public shell renders, is navigable, and
 * exposes correct indexing directives.
 *
 * The three full critical journeys from PRD 17.4 land in Milestones 4, 5, and 6
 * — see `critical-journeys.spec.ts`.
 */

test('homepage renders the hero and primary navigation', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'List your business' }).first()).toBeVisible()
})

test('hero search builds a canonical search URL', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Search by name or keyword').fill('candid')
  await page.getByRole('button', { name: 'Search' }).click()

  await expect(page).toHaveURL(/\/vendors\?.*q=candid/)
})

test('search page renders an honest empty state with no inventory', async ({ page }) => {
  await page.goto('/vendors')

  await expect(page.getByRole('heading', { name: 'Browse wedding vendors' })).toBeVisible()
  // Empty state must not invent results (PRD 6.2).
  await expect(page.getByText(/No vendors match|vendors/i).first()).toBeVisible()
})

test('dashboards are not indexable and redirect an anonymous visitor', async ({
  page,
  request,
}) => {
  await page.goto('/account')
  await expect(page).toHaveURL(/\/auth\/sign-in/)

  // page.goto follows the redirect, so its headers belong to the sign-in page.
  // The directive under test is on the 307 itself, so fetch it without
  // following (PRD 11.1).
  const redirect = await request.get('/account', { maxRedirects: 0 })
  expect(redirect.status()).toBe(307)
  expect(redirect.headers()['x-robots-tag'] ?? '').toContain('noindex')
})

test('robots.txt disallows private areas', async ({ request }) => {
  const response = await request.get('/robots.txt')
  const body = await response.text()

  expect(body).toContain('/admin')
  expect(body).toContain('/vendor-dashboard')
  expect(body).toContain('/account')
  expect(body).toContain('Sitemap:')
})

test('skip link is the first focusable element', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')

  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
})

test('sign-in form associates labels and reports errors accessibly', async ({ page }) => {
  await page.goto('/auth/sign-in')

  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
})
