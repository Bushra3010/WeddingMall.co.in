import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Conversation privacy at the *page* level (PRD 6.7).
 *
 * The database was never leaking between customers — a probe over PostgREST
 * confirmed each account reads only its own rows. What leaked was the page:
 * `/account/enquiries` had no ownership filter and trusted RLS, but
 * `enquiries: participant read` admits the customer **or a member of the
 * vendor** or an admin. So a vendor member's own account page listed the
 * enquiries sent *to* their business as though they had sent them.
 *
 * These tests therefore exercise the rendered page as a signed-in vendor
 * member, which is the only place that bug was visible. An RLS probe would
 * have passed throughout.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY

test.skip(!SUPABASE_URL || !ANON || !SERVICE_KEY, 'Supabase credentials are required')

const PASSWORD = 'ProbePassword123!'

async function db(request: APIRequestContext, path: string, init: Record<string, unknown> = {}) {
  const response = await request.fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    ...init,
  })
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function createUser(request: APIRequestContext, tag: string) {
  const email = `privacy-${tag}-${Date.now()}@example.test`
  const created = await request.fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  })
  return { id: (await created.json()).id as string, email }
}

test('a vendor member’s account page never lists another person’s enquiry', async ({
  page,
  request,
}) => {
  const vendor = (await db(request, 'vendors?select=id,display_name&status=eq.active&limit=1'))[0]
  const customer = await createUser(request, 'cust')
  const member = await createUser(request, 'member')

  await db(request, 'vendor_memberships', {
    method: 'POST',
    data: JSON.stringify({
      vendor_id: vendor.id,
      user_id: member.id,
      role: 'vendor_owner',
      status: 'active',
    }),
  })

  const marker = `PRIVACY-MARKER-${Date.now()}`
  const enquiry = (
    await db(request, 'enquiries', {
      method: 'POST',
      data: JSON.stringify({
        customer_id: customer.id,
        vendor_id: vendor.id,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        message: marker,
      }),
    })
  )[0]

  try {
    await page.goto('/auth/sign-in')
    await page.getByLabel(/email/i).first().fill(member.email)
    await page
      .getByLabel(/password/i)
      .first()
      .fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForTimeout(3000)

    // The list a vendor member sees on their own customer account page.
    await page.goto('/account/enquiries')
    await expect(page.getByText(marker)).toHaveCount(0)

    // And the customer's view of that specific enquiry is not theirs to open.
    const direct = await page.goto(`/account/enquiries/${enquiry.id}`)
    expect(direct?.status()).toBe(404)
  } finally {
    await db(request, `enquiries?id=eq.${enquiry.id}`, { method: 'DELETE' })
    await db(request, `vendor_memberships?user_id=eq.${member.id}`, { method: 'DELETE' })
    for (const id of [customer.id, member.id]) {
      await request.fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
      })
    }
  }
})
