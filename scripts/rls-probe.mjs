/**
 * RLS verification against the live project (PRD 17.2).
 *
 * Every probe runs with the ANON key over PostgREST — the same path a browser
 * takes. A probe that "reads 0 rows" is a pass only when the table is supposed
 * to be empty; where possible we seed a row with the service key first, so a
 * pass means the policy actually denied a row that exists.
 */
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SVC = process.env.SUPABASE_SECRET_KEY

const results = []
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function rest(path, key, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

// --- fixtures -------------------------------------------------------------

console.log('\nseeding fixtures with service key…')

const email = `rls-probe-${Date.now()}@example.test`
const userRes = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'ProbePassword123!', email_confirm: true }),
})
const user = await userRes.json()
if (!user.id) throw new Error(`could not create probe user: ${JSON.stringify(user)}`)
console.log(`  probe user ${user.id}`)

const cityId = (await rest('cities?select=id,slug&limit=1', SVC)).body?.[0]?.id
const category = (await rest('categories?select=id,slug&slug=eq.photographers', SVC)).body?.[0]

// A DRAFT vendor: must be invisible to anon everywhere.
const draft = (
  await rest('vendors', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      display_name: 'Probe Draft Studio',
      slug: `probe-draft-${Date.now()}`,
      owner_user_id: user.id,
      status: 'draft',
      primary_city_id: cityId,
    }),
  })
).body?.[0]

// An ACTIVE vendor with an APPROVED listing: must be visible and searchable.
const live = (
  await rest('vendors', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      display_name: 'Probe Live Studio',
      slug: `probe-live-${Date.now()}`,
      owner_user_id: user.id,
      status: 'active',
      verification_status: 'verified',
      primary_city_id: cityId,
      published_at: new Date().toISOString(),
    }),
  })
).body?.[0]

const liveListing = (
  await rest('vendor_listings', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      vendor_id: live.id,
      status: 'approved',
      about: 'Probe fixture listing.',
    }),
  })
).body?.[0]

// Since migration 0011 a vendor is public and searchable only once it has an
// APPROVED VERSION — an approved draft row is no longer sufficient.
await rest('vendor_listing_versions', SVC, {
  method: 'POST',
  body: JSON.stringify({
    listing_id: liveListing.id,
    vendor_id: live.id,
    version_no: 1,
    snapshot_json: { about: 'Probe fixture listing.' },
    status: 'approved',
    published_at: new Date().toISOString(),
  }),
})
await rest('vendor_listings', SVC, {
  method: 'POST',
  body: JSON.stringify({ vendor_id: draft.id, status: 'draft', about: 'Draft fixture listing.' }),
})
if (category) {
  await rest('vendor_categories', SVC, {
    method: 'POST',
    body: JSON.stringify({ vendor_id: live.id, category_id: category.id, is_primary: true }),
  })
}
await rest('vendor_packages', SVC, {
  method: 'POST',
  body: JSON.stringify({
    vendor_id: live.id,
    name: 'Probe package',
    price_type: 'starting_at',
    min_amount_minor: 5000000,
    currency: 'INR',
    active: true,
  }),
})

// Private-by-design rows that anon must never read.
const verification = (
  await rest('vendor_verifications', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ vendor_id: live.id, type: 'business_registration', status: 'pending' }),
  })
).body?.[0]
if (verification) {
  await rest('vendor_documents', SVC, {
    method: 'POST',
    body: JSON.stringify({
      verification_id: verification.id,
      storage_path: `${live.id}/probe.pdf`,
      document_type: 'gst',
    }),
  })
}
await rest('shortlists', SVC, {
  method: 'POST',
  body: JSON.stringify({ user_id: user.id, vendor_id: live.id, note: 'private note' }),
})
await rest('audit_logs', SVC, {
  method: 'POST',
  body: JSON.stringify({ action: 'probe', entity_type: 'vendor', entity_id: live.id }),
})

console.log('\npublic reads that SHOULD work (anon):')

for (const [label, path] of [
  ['categories readable', 'categories?select=id&limit=1'],
  ['cities readable', 'cities?select=id&limit=1'],
  ['plans readable', 'plans?select=id&limit=1'],
  ['faqs readable', 'faqs?select=id&limit=1'],
  ['public_vendors view readable', 'public_vendors?select=id&limit=1'],
]) {
  const r = await rest(path, ANON)
  record(
    label,
    r.status === 200 && Array.isArray(r.body) && r.body.length > 0,
    `status ${r.status}`,
  )
}

console.log('\nprivate reads that MUST be denied (anon):')

for (const [label, path] of [
  ['vendor_documents denied', 'vendor_documents?select=id'],
  ['vendor_verifications denied', 'vendor_verifications?select=id'],
  ['audit_logs denied', 'audit_logs?select=id'],
  ['shortlists denied', 'shortlists?select=id'],
  ['profiles denied', 'profiles?select=id'],
  ['webhook_events denied', 'webhook_events?select=id'],
  ['enquiries denied', 'enquiries?select=id'],
  ['enquiry_notes denied', 'enquiry_notes?select=id'],
  ['messages denied', 'messages?select=id'],
  ['notifications denied', 'notifications?select=id'],
  ['admin_memberships denied', 'admin_memberships?select=id'],
  ['vendor_availability denied', 'vendor_availability?select=id'],
]) {
  const r = await rest(path, ANON)
  const denied =
    r.status === 401 || r.status === 403 || (Array.isArray(r.body) && r.body.length === 0)
  record(label, denied, `status ${r.status}, rows ${Array.isArray(r.body) ? r.body.length : 'n/a'}`)
}

console.log('\ndraft vs published separation (anon):')

const draftSeen = await rest(`vendors?select=id&id=eq.${draft.id}`, ANON)
record(
  'draft vendor invisible',
  Array.isArray(draftSeen.body) && draftSeen.body.length === 0,
  `rows ${Array.isArray(draftSeen.body) ? draftSeen.body.length : 'n/a'}`,
)

const draftView = await rest(`public_vendors?select=id&id=eq.${draft.id}`, ANON)
record(
  'draft absent from public_vendors',
  Array.isArray(draftView.body) && draftView.body.length === 0,
)

const liveView = await rest(`public_vendors?select=id,display_name&id=eq.${live.id}`, ANON)
record(
  'active vendor visible in public_vendors',
  Array.isArray(liveView.body) && liveView.body.length === 1,
)

console.log('\nwrites that MUST be denied (anon):')

const inject = await rest('vendors', ANON, {
  method: 'POST',
  body: JSON.stringify({
    display_name: 'Evil',
    slug: `evil-${Date.now()}`,
    owner_user_id: user.id,
  }),
})
record('anon cannot insert a vendor', inject.status >= 400, `status ${inject.status}`)

const escalate = await rest('admin_memberships', ANON, {
  method: 'POST',
  body: JSON.stringify({ user_id: user.id, role_id: user.id, status: 'active' }),
})
record('anon cannot self-grant admin', escalate.status >= 400, `status ${escalate.status}`)

const tamper = await rest(`vendors?id=eq.${live.id}`, ANON, {
  method: 'PATCH',
  body: JSON.stringify({ rating_average: 5 }),
})
const tamperCheck = await rest(`vendors?select=rating_average&id=eq.${live.id}`, SVC)
record(
  'anon cannot change a rating',
  Number(tamperCheck.body?.[0]?.rating_average) !== 5,
  `status ${tamper.status}, rating now ${tamperCheck.body?.[0]?.rating_average}`,
)

console.log('\nsearch contract (anon):')

const search = await fetch(`${URL_BASE}/rest/v1/rpc/search_vendors`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ filters: { limit: 10 } }),
})
const searchBody = await search.json()
record(
  'search_vendors callable by anon',
  search.status === 200 && Array.isArray(searchBody),
  `status ${search.status}, rows ${Array.isArray(searchBody) ? searchBody.length : 'n/a'}`,
)
record(
  'search returns the active vendor',
  Array.isArray(searchBody) && searchBody.some((r) => r.vendor_id === live.id),
)
record(
  'search excludes the draft vendor',
  Array.isArray(searchBody) && !searchBody.some((r) => r.vendor_id === draft.id),
)
if (Array.isArray(searchBody) && searchBody.length) {
  const row = searchBody[0]
  record(
    'search row shape matches the DAL contract',
    ['vendor_id', 'slug', 'display_name', 'rank_score', 'total_count'].every((k) => k in row),
    Object.keys(row).join(','),
  )
}

console.log('\nprivate storage (anon):')

const obj = await fetch(`${URL_BASE}/storage/v1/object/vendor-documents/${live.id}/probe.pdf`, {
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
})
record('private bucket object not public', obj.status >= 400, `status ${obj.status}`)

// --- cleanup --------------------------------------------------------------

console.log('\ncleaning up fixtures…')
await rest(`shortlists?vendor_id=eq.${live.id}`, SVC, { method: 'DELETE' })
await rest(`audit_logs?entity_id=eq.${live.id}`, SVC, { method: 'DELETE' })
await rest(`vendors?id=eq.${draft.id}`, SVC, { method: 'DELETE' })
await rest(`vendors?id=eq.${live.id}`, SVC, { method: 'DELETE' })
await fetch(`${URL_BASE}/auth/v1/admin/users/${user.id}`, {
  method: 'DELETE',
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
})

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(`  - ${f.name} (${f.detail})`)
}
process.exit(failed.length ? 1 : 0)
