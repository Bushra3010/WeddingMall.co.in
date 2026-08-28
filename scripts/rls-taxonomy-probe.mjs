/**
 * Deleting from the admin catalogue: who may, and what each delete refuses to
 * take with it (PRD 6.11, 9.5).
 *
 * Seven tables reference `cities`, and until migration 0032 two of them
 * cascaded — so deleting a city in use silently removed vendors' service areas
 * and nulled their primary city. The admin page had no delete button, which is
 * the only reason that never fired.
 *
 * Every assertion runs over PostgREST with a real JWT, so it exercises the path
 * the browser takes rather than the service role's blanket bypass. A refusal is
 * always confirmed by reading the target table afterwards, never by the status
 * code the write returned: `Prefer: return=representation` has twice made a
 * successful write look like a refusal in this repo's probes (ADR-021).
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

const rpc = (fn, id, key, jwt) =>
  rest(`rpc/${fn}`, key, { method: 'POST', body: JSON.stringify({ p_id: id }) }, jwt)

const deleteCity = (id, key, jwt) => rpc('delete_city', id, key, jwt)

/** Does a row still exist? Read as the service role, so RLS cannot make a
 *  surviving row look deleted. */
async function stillThere(table, id) {
  const { body } = await rest(`${table}?select=id&id=eq.${id}`, SVC)
  return Array.isArray(body) && body.length === 1
}

/** Does this city still exist? Read as the service role, so RLS cannot make a
 *  surviving row look deleted. */
async function cityExists(id) {
  const { body } = await rest(`cities?select=id&id=eq.${id}`, SVC)
  return Array.isArray(body) && body.length === 1
}

async function createUser(tag) {
  const email = `taxonomy-${tag}-${Date.now()}@example.test`
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

async function makeAdmin(userId, roleCode) {
  const role = (await rest(`admin_roles?select=id&code=eq.${roleCode}`, SVC)).body[0]
  await rest('admin_memberships', SVC, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role_id: role.id, status: 'active' }),
  })
}

const cleanup = []

try {
  const stranger = await createUser('stranger')
  cleanup.push(() =>
    fetch(`${URL_BASE}/auth/v1/admin/users/${stranger.id}`, {
      method: 'DELETE',
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    }),
  )
  const admin = await createUser('admin')
  await makeAdmin(admin.id, 'super_admin')
  cleanup.push(() =>
    fetch(`${URL_BASE}/auth/v1/admin/users/${admin.id}`, {
      method: 'DELETE',
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    }),
  )

  const state = (await rest('states?select=id,name&limit=1', SVC)).body[0]

  /** A disposable city, so nothing the marketplace depends on is at risk. */
  async function makeCity(tag) {
    const { body } = await rest('cities?select=id', SVC, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        state_id: state.id,
        name: `Probe ${tag}`,
        slug: `probe-${tag}-${Date.now()}`,
        active: false,
      }),
    })
    const id = body[0].id
    cleanup.push(() => rest(`cities?id=eq.${id}`, SVC, { method: 'DELETE' }))
    return id
  }

  // -------------------------------------------------------------------------
  // 1. Who may call it at all
  // -------------------------------------------------------------------------
  const anonTarget = await makeCity('anon')
  await deleteCity(anonTarget, ANON)
  record('an anonymous caller cannot delete a city', await cityExists(anonTarget))

  const strangerTarget = await makeCity('stranger')
  await deleteCity(strangerTarget, ANON, stranger.jwt)
  record(
    'a signed-in non-admin cannot delete a city',
    await cityExists(strangerTarget),
    'RLS on cities, not the grant',
  )

  // -------------------------------------------------------------------------
  // 2. An admin can — but only when nothing points at it
  // -------------------------------------------------------------------------
  const unused = await makeCity('unused')
  const okRes = await deleteCity(unused, ANON, admin.jwt)
  record(
    'an admin deletes an unused city',
    !(await cityExists(unused)),
    `HTTP ${okRes.status}`,
  )

  // A vendor covering the city is the case that used to cascade away silently.
  const vendor = (await rest('vendors?select=id&limit=1', SVC)).body[0]
  const inUse = await makeCity('inuse')
  const area = await rest('vendor_service_areas?select=id', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ vendor_id: vendor.id, city_id: inUse, travel_available: false }),
  })
  const areaId = area.body?.[0]?.id
  cleanup.push(() => rest(`vendor_service_areas?id=eq.${areaId}`, SVC, { method: 'DELETE' }))

  const refused = await deleteCity(inUse, ANON, admin.jwt)
  record(
    'a city with a vendor covering it is refused',
    await cityExists(inUse),
    `HTTP ${refused.status}`,
  )

  // The refusal is only worth anything if the coverage row is still there —
  // this is the exact row the old CASCADE would have taken.
  const survived = await rest(`vendor_service_areas?select=id&id=eq.${areaId}`, SVC)
  record(
    "the vendor's service area survived the refusal",
    Array.isArray(survived.body) && survived.body.length === 1,
  )

  record(
    'the refusal says what is in the way',
    typeof refused.body?.message === 'string' && /still in use/.test(refused.body.message),
    refused.body?.message ?? JSON.stringify(refused.body),
  )

  // -------------------------------------------------------------------------
  // 3. The constraint holds even without the function
  // -------------------------------------------------------------------------
  const direct = await rest(`cities?id=eq.${inUse}`, SVC, { method: 'DELETE' })
  record(
    'even the service role cannot cascade it away directly',
    await cityExists(inUse),
    `HTTP ${direct.status} — the FK is RESTRICT now, so this is enforced below RLS`,
  )
  // -------------------------------------------------------------------------
  // 4. Categories — the cascade runs two tables deep
  // -------------------------------------------------------------------------
  const { body: catBody } = await rest('categories?select=id', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: 'Probe Category', slug: `probe-cat-${Date.now()}`, active: false }),
  })
  const catId = catBody[0].id
  cleanup.push(() => rest(`categories?id=eq.${catId}`, SVC, { method: 'DELETE' }))

  const okCat = await rpc('delete_category', catId, ANON, admin.jwt)
  record('an admin deletes an unused category', !(await stillThere('categories', catId)), `HTTP ${okCat.status}`)

  // One with an attribute hanging off it: `category_attributes` cascades from
  // `categories`, and `vendor_attribute_values` cascades from that.
  const { body: cat2Body } = await rest('categories?select=id', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: 'Probe Category 2', slug: `probe-cat2-${Date.now()}`, active: false }),
  })
  const cat2 = cat2Body[0].id
  cleanup.push(() => rest(`categories?id=eq.${cat2}`, SVC, { method: 'DELETE' }))
  const { body: attrBody } = await rest('category_attributes?select=id', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      category_id: cat2, code: 'probe_attr', label: 'Probe attribute',
      input_type: 'text', data_type: 'string',
    }),
  })
  const attrId = attrBody[0].id
  cleanup.push(() => rest(`category_attributes?id=eq.${attrId}`, SVC, { method: 'DELETE' }))

  const refusedCat = await rpc('delete_category', cat2, ANON, admin.jwt)
  record('a category with an attribute is refused', await stillThere('categories', cat2), `HTTP ${refusedCat.status}`)
  record('its attribute survived the refusal', await stillThere('category_attributes', attrId))

  // -------------------------------------------------------------------------
  // 5. Attributes — deletes, and reports what went with it
  // -------------------------------------------------------------------------
  const answered = await rest('vendor_attribute_values?select=vendor_id', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ vendor_id: vendor.id, category_attribute_id: attrId, value_json: 'probe' }),
  })
  record('an answer was created to delete alongside', answered.status === 201, `HTTP ${answered.status}`)

  const delAttr = await rpc('delete_attribute', attrId, ANON, admin.jwt)
  record('an attribute is deleted', !(await stillThere('category_attributes', attrId)), `HTTP ${delAttr.status}`)
  record(
    'it reports how many vendor answers went with it',
    delAttr.body === 1 || delAttr.body === '1',
    `returned ${JSON.stringify(delAttr.body)}`,
  )
  const orphans = await rest(`vendor_attribute_values?select=vendor_id&category_attribute_id=eq.${attrId}`, SVC)
  record('the answers are actually gone, not orphaned', Array.isArray(orphans.body) && orphans.body.length === 0)

  // -------------------------------------------------------------------------
  // 6. Content pages — the five that back public routes are protected
  // -------------------------------------------------------------------------
  const systemPage = (await rest('pages?select=id,slug,title&slug=eq.privacy', SVC)).body[0]
  if (systemPage) {
    const refusedPage = await rpc('delete_page', systemPage.id, ANON, admin.jwt)
    record('a system page cannot be deleted', await stillThere('pages', systemPage.id), `HTTP ${refusedPage.status}`)
  } else {
    record('a system page cannot be deleted', false, 'no /privacy page seeded')
  }

  const { body: pageBody } = await rest('pages?select=id', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ slug: `probe-page-${Date.now()}`, title: 'Probe page', status: 'draft' }),
  })
  const pageId = pageBody[0].id
  cleanup.push(() => rest(`pages?id=eq.${pageId}`, SVC, { method: 'DELETE' }))
  const okPage = await rpc('delete_page', pageId, ANON, admin.jwt)
  record('an ordinary page is deleted', !(await stillThere('pages', pageId)), `HTTP ${okPage.status}`)

  // -------------------------------------------------------------------------
  // 7. Plans — refused while anything bills against them
  // -------------------------------------------------------------------------
  const { body: planBody } = await rest('plans?select=id', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      code: `probe-plan-${Date.now()}`, name: 'Probe plan',
      billing_interval: 'monthly', amount_minor: 0, active: false,
    }),
  })
  const planId = planBody[0].id
  cleanup.push(() => rest(`plans?id=eq.${planId}`, SVC, { method: 'DELETE' }))

  const inUsePlan = (await rest('plans?select=id&limit=1', SVC)).body[0]
  const vendorOnPlan = await rest(`vendors?id=eq.${vendor.id}`, SVC, {
    method: 'PATCH',
    body: JSON.stringify({ plan_id: inUsePlan.id }),
  })
  cleanup.push(() => rest(`vendors?id=eq.${vendor.id}`, SVC, { method: 'PATCH', body: JSON.stringify({ plan_id: null }) }))
  record('a vendor was put on a plan to block its delete', vendorOnPlan.status < 300, `HTTP ${vendorOnPlan.status}`)

  const refusedPlan = await rpc('delete_plan', inUsePlan.id, ANON, admin.jwt)
  record('a plan in use is refused', await stillThere('plans', inUsePlan.id), `HTTP ${refusedPlan.status}`)

  const okPlan = await rpc('delete_plan', planId, ANON, admin.jwt)
  record('an unused plan is deleted', !(await stillThere('plans', planId)), `HTTP ${okPlan.status}`)

  // -------------------------------------------------------------------------
  // 8. Businesses (migration 0035)
  //
  // `public.vendors` had no DELETE policy at all before 0035 — not a
  // restrictive one, none — so a delete matched zero rows and PostgREST
  // answered 200 with an empty body. "Refused" and "done" were indistinguishable
  // to the caller, which is why every assertion here reads the table back
  // rather than trusting a status code.
  //
  // Fifteen tables carry a `vendor_id` and thirteen cascade, including
  // `reviews`. `delete_vendor()` refuses rather than taking a customer's review
  // with the business it is about.
  // -------------------------------------------------------------------------
  const verifier = await createUser('verifier')
  await makeAdmin(verifier.id, 'vendor_verifier')
  cleanup.push(() =>
    fetch(`${URL_BASE}/auth/v1/admin/users/${verifier.id}`, {
      method: 'DELETE',
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    }),
  )

  /** A disposable business, so no real supply is at risk. */
  async function makeVendor(tag) {
    const { body } = await rest('vendors?select=id', SVC, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        display_name: `Probe ${tag}`,
        slug: `probe-vendor-${tag}-${Date.now()}`,
        owner_user_id: stranger.id,
        status: 'draft',
      }),
    })
    const id = body[0].id
    cleanup.push(() => rest(`vendors?id=eq.${id}`, SVC, { method: 'DELETE' }))
    return id
  }

  const guardedVendor = await makeVendor('guarded')
  await rpc('delete_vendor', guardedVendor, ANON)
  record('an anonymous caller cannot delete a business', await stillThere('vendors', guardedVendor))
  await rpc('delete_vendor', guardedVendor, ANON, stranger.jwt)
  record(
    'a signed-in non-admin cannot delete a business',
    await stillThere('vendors', guardedVendor),
  )

  // The distinction the policy exists to draw. A verifier decides whether a
  // business goes live and can suspend one; removing it outright is a
  // different act, and `admin.manage` is the only thing that grants it.
  await rpc('delete_vendor', guardedVendor, ANON, verifier.jwt)
  record(
    'a vendor verifier cannot delete a business, only suspend it',
    await stillThere('vendors', guardedVendor),
  )

  const busyVendor = await makeVendor('busy')
  const { body: subBody } = await rest('subscriptions?select=id', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ vendor_id: busyVendor, plan_id: inUsePlan.id, status: 'active' }),
  })
  const subId = subBody?.[0]?.id
  cleanup.push(() => rest(`subscriptions?id=eq.${subId}`, SVC, { method: 'DELETE' }))
  record('a business was given a subscription to block its delete', Boolean(subId))

  const refusedVendor = await rpc('delete_vendor', busyVendor, ANON, admin.jwt)
  record(
    'a business with commercial history is refused even for a super admin',
    await stillThere('vendors', busyVendor),
    `HTTP ${refusedVendor.status}`,
  )

  await rest(`subscriptions?id=eq.${subId}`, SVC, { method: 'DELETE' })
  const okVendor = await rpc('delete_vendor', busyVendor, ANON, admin.jwt)
  record(
    'the same business deletes once nothing points at it',
    !(await stillThere('vendors', busyVendor)),
    `HTTP ${okVendor.status}`,
  )

  // -------------------------------------------------------------------------
  // 9. None of this is reachable without the right role
  // -------------------------------------------------------------------------
  const { body: guardBody } = await rest('categories?select=id', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: 'Probe guard', slug: `probe-guard-${Date.now()}`, active: false }),
  })
  const guardId = guardBody[0].id
  cleanup.push(() => rest(`categories?id=eq.${guardId}`, SVC, { method: 'DELETE' }))
  await rpc('delete_category', guardId, ANON, stranger.jwt)
  record('a signed-in non-admin cannot delete a category', await stillThere('categories', guardId))
  await rpc('delete_category', guardId, ANON)
  record('an anonymous caller cannot delete a category', await stillThere('categories', guardId))
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
