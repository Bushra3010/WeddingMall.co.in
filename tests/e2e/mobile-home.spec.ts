import { expect, test } from '@playwright/test'

/**
 * Mobile homepage layout (PRD 6.1, 7.4).
 *
 * The phone layout is not a narrower copy of the desktop one — the search
 * folds most of its fields behind a disclosure, categories become circles, the
 * statistics move out of the hero, and the vendor grid becomes a scroll rail.
 * Each of those is a place a value or a control can quietly disappear, so they
 * are asserted rather than eyeballed.
 */
/*
 * The viewport is set by hand rather than with `devices['iPhone 14']`: the
 * device presets also select WebKit, and the only configured project is
 * Chromium. Everything asserted here is driven by CSS width, so the viewport
 * is the part that matters.
 */
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})

test('collapsed filters are still submitted', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /Category, city, budget, date/ }).click()
  await page.getByLabel('City', { exact: true }).selectOption('mumbai')
  await page.getByLabel('Category', { exact: true }).selectOption('photographers')

  // Fold them away again: hiding a control must not discard its value.
  await page.getByRole('button', { name: 'Fewer filters' }).click()
  await expect(page.locator('#hero-search-filters')).toBeHidden()

  await page.getByLabel('Search by name or keyword').fill('salt')
  await page.getByRole('button', { name: 'Search', exact: true }).click()

  await expect(page).toHaveURL(/\/vendors\/photographers\/mumbai\?.*q=salt/)
})

test('the header city selector scopes a search', async ({ page }) => {
  await page.goto('/')

  await page.locator('header select[name="city"]').selectOption('jaipur')

  await expect(page).toHaveURL(/\/vendors\?.*city=jaipur/)
})

test('the page does not scroll sideways', async ({ page }) => {
  await page.goto('/')

  // A rail that bleeds past the gutter must scroll inside itself, never take
  // the document with it.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('the featured rail scrolls horizontally and keeps its left gutter', async ({ page }) => {
  await page.goto('/')

  const rail = page.locator('#home-featured').locator('xpath=ancestor::section').locator('ul')
  const box = await rail.evaluate((el) => ({
    scrollable: el.scrollWidth > el.clientWidth,
    // Scroll snapping will steal the gutter unless scroll-padding is set.
    scrollLeft: el.scrollLeft,
  }))

  expect(box.scrollable).toBe(true)
  expect(box.scrollLeft).toBe(0)
})

test('a signed-out visitor gets a sign-in link, not a failing save', async ({ page }) => {
  await page.goto('/')

  const save = page.locator('a[aria-label^="Sign in to save"]').first()
  await expect(save).toHaveAttribute('href', /\/auth\/sign-in\?next=/)
})

test('the bottom bar marks the current section', async ({ page }) => {
  await page.goto('/vendors')

  const bar = page.getByRole('navigation', { name: 'Primary' })
  await expect(bar.locator('[aria-current="page"]')).toHaveText('Explore')
})

test('the More sheet opens, closes on Escape, and reaches the rest of the site', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'More' }).click()
  const sheet = page.locator('#more-menu')
  await expect(sheet).toBeVisible()
  // Everything the old hamburger menu carried has to survive the move.
  await expect(sheet.getByRole('link', { name: 'Categories' })).toBeVisible()
  await expect(sheet.getByRole('link', { name: 'List your business' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
})

test('the fixed bar does not cover the end of the page', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

  // The bar is fixed, so the layout has to reserve its height; otherwise the
  // page scrolls to its end with the last row still hidden underneath.
  // Measured as an overlap in pixels rather than a boolean: sub-pixel layout
  // puts the footer's edge a fraction below the bar's, while a missing spacer
  // would bury it by the bar's full 65px.
  const overlap = await page.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="Primary"]')!.getBoundingClientRect()
    const footer = document.querySelector('footer')!.getBoundingClientRect()
    return footer.bottom - bar.top
  })

  expect(overlap).toBeLessThanOrEqual(1)
})

test('statistics appear exactly once', async ({ page }) => {
  await page.goto('/')

  // The hero hides them below `lg` and the strip shows them. Both are in the
  // DOM at every width, so count what is actually rendered — a breakpoint
  // mismatch would show the figures twice or not at all.
  const visible = await page
    .getByText('Cities covered')
    .evaluateAll((nodes) => nodes.filter((node) => node.checkVisibility()).length)

  expect(visible).toBe(1)
})

test('the server-rendered homepage carries no session-specific markup', async ({ request }) => {
  // The homepage is statically prerendered and edge-cached, so one visitor's
  // HTML is served to everyone. Anything session-dependent has to be resolved
  // in the browser; if it ever gets baked into this response it is not just a
  // stale label, it is one account's state shown to strangers.
  const html = await (await request.get('/')).text()

  expect(html).not.toContain('Sign out')
  // Saved-state labels only exist for a signed-in user.
  expect(html).not.toContain('from shortlist')
})
