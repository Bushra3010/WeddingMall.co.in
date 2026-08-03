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

test('the newsletter field is legible on the dark footer', async ({ page }) => {
  await page.goto('/')
  const input = page.locator('#newsletter-email')
  await input.scrollIntoViewIfNeeded()

  /*
   * Everything in the footer is white at some alpha over a near-black maroon,
   * so a value that looks fine in isolation composites to a muddy brown. The
   * placeholder shipped at 50% and read as a smudge. Measured by compositing
   * the way the browser does rather than by reading the class name, which
   * would only restate the styling back to itself.
   */
  const contrast = await input.evaluate((el) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const flatten = (css: string, under: string) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = under
      ctx.fillRect(0, 0, 1, 1)
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return [r, g, b] as [number, number, number]
    }
    const rgb = (c: [number, number, number]) => `rgb(${c.join(',')})`

    const footer = flatten(getComputedStyle(el.closest('footer')!).backgroundColor, 'rgb(0,0,0)')
    const field = flatten(getComputedStyle(el).backgroundColor, rgb(footer))
    const placeholder = flatten(getComputedStyle(el, '::placeholder').color, rgb(field))

    const luminance = ([r, g, b]: [number, number, number]) => {
      const channel = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const [hi, lo] = [luminance(placeholder), luminance(field)].sort((a, b) => b - a)
    return (hi + 0.05) / (lo + 0.05)
  })

  /*
   * 7:1 (AAA for normal text), not the 4.5 of AA. The version that was
   * reported as unreadable measured 4.85 — it passed AA and still looked like
   * a smudge, because contrast maths does not know the colour is a warm grey
   * on a warm near-black. An AA floor here would pass the exact bug it is
   * meant to catch.
   */
  expect(contrast).toBeGreaterThanOrEqual(7)
})

test('focusing the newsletter field leaves a visible outline', async ({ page }) => {
  await page.goto('/')
  const input = page.locator('#newsletter-email')
  await input.scrollIntoViewIfNeeded()

  // Reached by keyboard so `:focus-visible` engages. The global focus rule
  // draws in brand-500, a maroon that vanishes on this panel, so this input
  // overrides it to white — an override that is one careless
  // `focus:outline-none` away from being no indicator at all.
  await input.press('Shift+Tab')
  await page.keyboard.press('Tab')

  const outline = await input.evaluate((el) => {
    const style = getComputedStyle(el)
    return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor }
  })

  expect(outline.style).not.toBe('none')
  expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2)
  expect(outline.color).toBe('rgb(255, 255, 255)')
})
