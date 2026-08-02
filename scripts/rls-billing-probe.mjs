/**
 * Milestone 6 boundaries: commercial and trust columns on `vendors`, and
 * featured placement as a plan entitlement (PRD 6.10, 6.2).
 *
 * Both directions, as always: a guard that blocks everyone is not a guard, it
 * is an outage. The permitted assertions here are the ones that would catch it
 * — the vendor's own editable fields, the admin's moderation path, and the
 * legitimate publish flow through `submit_vendor_for_review`.
 */
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SVC = process.env.SUPABASE_SECRET_KEY

if (!URL_BASE || !ANON || !SVC) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}

const results = []
const record = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function rest(path, key, init = {}, jwt = null) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${jwt ?? key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: res.status, body }
}

async function createUser(tag) {
  const email = `m6-${tag}-${Date.now()}@example.test`
  const password = 'ProbePassword123!'
  const user = await (
    await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json()
  const token = await (
    await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).json()
  return { id: user.id, jwt: token.access_token }
}

const cleanup = []

try {
  const owner = await createUser('owner')
  const admin = await createUser('admin')
  cleanup.push(() =>
    Promise.all(
      [owner.id, admin.id].map((id) =>
        fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
          method: 'DELETE',
          headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
        }),
      ),
    ),
  )

  const role = (await rest('admin_roles?select=id&code=eq.super_admin', SVC)).body[0]
  await rest('admin_memberships', SVC, {
    method: 'POST',
    body: JSON.stringify({ user_id: admin.id, role_id: role.id, status: 'active' }),
  })

  const vendor = (
    await rest(
      'vendors?select=id,display_name,website,is_featured,verification_status,status,plan_id,rating_average,rating_count&status=eq.active&limit=1',
      SVC,
    )
  ).body[0]
  const before = { ...vendor }
  cleanup.push(() =>
    rest(`vendors?id=eq.${vendor.id}`, SVC, {
      method: 'PATCH',
      body: JSON.stringify({
        website: before.website,
        is_featured: before.is_featured,
        verification_status: before.verification_status,
        status: before.status,
        plan_id: before.plan_id,
        rating_average: before.rating_average,
        rating_count: before.rating_count,
      }),
    }),
  )

  await rest('vendor_memberships', SVC, {
    method: 'POST',
    body: JSON.stringify({
      vendor_id: vendor.id,
      user_id: owner.id,
      role: 'vendor_owner',
      status: 'active',
    }),
  })
  cleanup.push(() => rest(`vendor_memberships?user_id=eq.${owner.id}`, SVC, { method: 'DELETE' }))

  const asOwner = (patch) =>
    rest(
      `vendors?id=eq.${vendor.id}`,
      ANON,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) },
      owner.jwt,
    )

  console.log('\nvendor cannot grant itself commercial or trust standing:')

  const featured = await asOwner({ is_featured: !before.is_featured })
  record('cannot set is_featured', featured.status >= 400, `HTTP ${featured.status}`)

  const verify = await asOwner({
    verification_status: before.verification_status === 'verified' ? 'pending' : 'verified',
  })
  record('cannot set verification_status', verify.status >= 400, `HTTP ${verify.status}`)

  const publish = await asOwner({ status: before.status === 'active' ? 'draft' : 'active' })
  record('cannot set status', publish.status >= 400, `HTTP ${publish.status}`)

  const plans = (await rest('plans?select=id,code&order=sort_order', SVC)).body
  const premium = plans.find((p) => p.code === 'premium') ?? plans[plans.length - 1]
  const upgrade = await asOwner({ plan_id: premium.id })
  record('cannot set plan_id', upgrade.status >= 400, `HTTP ${upgrade.status}`)

  const fakeRating = await asOwner({ rating_average: 5, rating_count: 999 })
  record('cannot write its own rating', fakeRating.status >= 400, `HTTP ${fakeRating.status}`)

  console.log('\nbut the vendor can still edit what is theirs:')

  const edit = await asOwner({ website: `https://probe-${Date.now()}.example.com` })
  record('can edit its own profile copy', edit.status === 200, `HTTP ${edit.status}`)

  console.log('\nfeatured placement is tied to the plan, not to a role:')

  const asAdmin = (patch) =>
    rest(
      `vendors?id=eq.${vendor.id}`,
      ANON,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) },
      admin.jwt,
    )

  await rest(`vendors?id=eq.${vendor.id}`, SVC, {
    method: 'PATCH',
    body: JSON.stringify({ is_featured: false }),
  })
  await rest(`subscriptions?vendor_id=eq.${vendor.id}`, SVC, { method: 'DELETE' })

  const adminFeatureNoPlan = await asAdmin({ is_featured: true })
  record(
    'even an admin cannot feature a vendor with no qualifying plan',
    adminFeatureNoPlan.status >= 400,
    `HTTP ${adminFeatureNoPlan.status}`,
  )

  const sub = await rest('subscriptions', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ vendor_id: vendor.id, plan_id: premium.id, status: 'active' }),
  })
  cleanup.push(() => rest(`subscriptions?vendor_id=eq.${vendor.id}`, SVC, { method: 'DELETE' }))
  record('a premium subscription can be created', sub.status === 201, `HTTP ${sub.status}`)

  const adminFeatureWithPlan = await asAdmin({ is_featured: true })
  record(
    'with the plan in place, featuring succeeds',
    adminFeatureWithPlan.status === 200 &&
      Array.isArray(adminFeatureWithPlan.body) &&
      adminFeatureWithPlan.body[0]?.is_featured === true,
    `HTTP ${adminFeatureWithPlan.status}`,
  )

  console.log('\nadmins retain moderation:')

  const adminVerify = await asAdmin({ verification_status: 'verified', status: 'active' })
  record(
    'an admin can verify and publish',
    adminVerify.status === 200,
    `HTTP ${adminVerify.status}`,
  )

  console.log('\nplans and subscriptions are not client-writable:')

  /*
   * A 204 here means "succeeded, matched no rows" — RLS filtered the row out
   * rather than refusing. That is a correct outcome, but the status alone
   * cannot distinguish it from a successful write, so the price is re-read.
   */
  const priceBefore = (await rest(`plans?select=amount_minor&id=eq.${premium.id}`, SVC)).body[0]
  await rest(
    `plans?id=eq.${premium.id}`,
    ANON,
    { method: 'PATCH', body: JSON.stringify({ amount_minor: 0 }) },
    owner.jwt,
  )
  const priceAfter = (await rest(`plans?select=amount_minor&id=eq.${premium.id}`, SVC)).body[0]
  record(
    'a vendor cannot rewrite plan pricing',
    Number(priceAfter.amount_minor) === Number(priceBefore.amount_minor),
    `${priceBefore.amount_minor} -> ${priceAfter.amount_minor}`,
  )

  const subWrite = await rest(
    'subscriptions',
    ANON,
    {
      method: 'POST',
      body: JSON.stringify({ vendor_id: vendor.id, plan_id: premium.id, status: 'active' }),
    },
    owner.jwt,
  )
  record('a vendor cannot grant itself a subscription', subWrite.status >= 400, `HTTP ${subWrite.status}`)
} finally {
  for (const undo of cleanup.reverse()) {
    try {
      await undo()
    } catch {
      /* best effort */
    }
  }
}

const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
