/**
 * Milestone 3 boundaries: listing versioning, media moderation, availability
 * privacy, and slug redirects (PRD 6.3, 6.9, 11.2, Epic B).
 *
 * The central guarantee under test: an edit to an approved listing must NOT
 * reach the public page, the public view, or search until a moderator approves
 * it. Before migration 0011 every one of these assertions failed.
 */
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SVC = process.env.SUPABASE_SECRET_KEY

const results = []
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
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

async function rpc(fn, args, jwt) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt ?? ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
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
  const email = `m3-${tag}-${Date.now()}@example.test`
  const password = 'ProbePassword123!'
  const u = await (
    await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json()
  const t = await (
    await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).json()
  return { id: u.id, email, jwt: t.access_token }
}

console.log('\ncreating a published vendor…')
const owner = await createUser('owner')
const moderator = await createUser('moderator')
const analyst = await createUser('analyst')

for (const [user, role] of [
  [moderator, 'operations_admin'],
  [analyst, 'analyst'],
]) {
  const r = (await rest(`admin_roles?select=id&code=eq.${role}`, SVC)).body[0]
  await rest('admin_memberships', SVC, {
    method: 'POST',
    body: JSON.stringify({ user_id: user.id, role_id: r.id, status: 'active' }),
  })
}

const city = (await rest('cities?select=id&slug=eq.pune', SVC)).body[0]
const category = (await rest('categories?select=id&slug=eq.decorators', SVC)).body[0]
const slug = `m3-probe-${Date.now()}`

const vendor = (
  await rest('vendors', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      display_name: 'M3 Probe Decor',
      slug,
      owner_user_id: owner.id,
      status: 'draft',
      primary_city_id: city.id,
    }),
  })
).body[0]

await rest('vendor_memberships', SVC, {
  method: 'POST',
  body: JSON.stringify({
    vendor_id: vendor.id,
    user_id: owner.id,
    role: 'vendor_owner',
    status: 'active',
  }),
})
await rest('vendor_listings', SVC, {
  method: 'POST',
  body: JSON.stringify({
    vendor_id: vendor.id,
    status: 'draft',
    about: 'ORIGINAL PUBLISHED TEXT. '.repeat(3),
  }),
})
await rest('vendor_categories', SVC, {
  method: 'POST',
  body: JSON.stringify({ vendor_id: vendor.id, category_id: category.id, is_primary: true }),
})
await rest('vendor_service_areas', SVC, {
  method: 'POST',
  body: JSON.stringify({ vendor_id: vendor.id, city_id: city.id }),
})

await rpc('submit_vendor_for_review', { target_vendor: vendor.id }, owner.jwt)
await rpc('admin_decide_vendor', { target_vendor: vendor.id, decision: 'approve' }, moderator.jwt)

// ---------------------------------------------------------------------------
console.log('\nfirst publication:')

const published = await rest(
  `public_vendors?select=about,published_version_no&id=eq.${vendor.id}`,
  ANON,
)
record(
  'approval creates a published version',
  published.body?.[0]?.published_version_no === 1,
  `version ${published.body?.[0]?.published_version_no}`,
)
record(
  'the public page shows the approved text',
  (published.body?.[0]?.about ?? '').startsWith('ORIGINAL'),
)

// ---------------------------------------------------------------------------
console.log('\nan unreviewed edit must not leak:')

await rest(
  `vendor_listings?vendor_id=eq.${vendor.id}`,
  ANON,
  { method: 'PATCH', body: JSON.stringify({ about: 'SECRET UNREVIEWED EDIT. '.repeat(3) }) },
  owner.jwt,
)

const afterEdit = await rest(`public_vendors?select=about&id=eq.${vendor.id}`, ANON)
record(
  'editing the draft does not change the public page',
  (afterEdit.body?.[0]?.about ?? '').startsWith('ORIGINAL'),
  (afterEdit.body?.[0]?.about ?? '').slice(0, 30),
)

const leakSearch = await rpc('search_vendors', { filters: { q: 'SECRET UNREVIEWED' } }, null)
record(
  'the unreviewed text is not searchable',
  Array.isArray(leakSearch.body) && leakSearch.body.length === 0,
  `hits ${leakSearch.body?.length}`,
)

const anonDraft = await rest(`vendor_listings?select=about&vendor_id=eq.${vendor.id}`, ANON)
record(
  'anon cannot read the draft listing row',
  Array.isArray(anonDraft.body) && anonDraft.body.length === 0,
)

// ---------------------------------------------------------------------------
console.log('\nsubmitting an edit:')

const submit = await rpc('submit_listing_for_review', { target_vendor: vendor.id }, owner.jwt)
record('owner can submit an edit', submit.status === 200, `status ${submit.status}`)

const stillOriginal = await rest(`public_vendors?select=about&id=eq.${vendor.id}`, ANON)
record(
  'the published version stays live while the edit is pending',
  (stillOriginal.body?.[0]?.about ?? '').startsWith('ORIGINAL'),
)

const double = await rpc('submit_listing_for_review', { target_vendor: vendor.id }, owner.jwt)
record(
  'a second submission is refused while one is pending',
  double.status >= 400 && /already awaiting/i.test(double.body?.message ?? ''),
  double.body?.message ?? '',
)

const pendingVersion = (
  await rest(
    `vendor_listing_versions?select=id,version_no&vendor_id=eq.${vendor.id}&status=eq.pending`,
    SVC,
  )
).body[0]

const anonPending = await rest(`vendor_listing_versions?select=id&id=eq.${pendingVersion.id}`, ANON)
record(
  'anon cannot read a pending version',
  Array.isArray(anonPending.body) && anonPending.body.length === 0,
)

// ---------------------------------------------------------------------------
console.log('\nmoderation:')

const analystModerate = await rpc(
  'moderate_listing_version',
  { target_version: pendingVersion.id, decision: 'approve' },
  analyst.jwt,
)
record(
  'an admin without listing.moderate cannot approve',
  analystModerate.status >= 400,
  `status ${analystModerate.status}`,
)

const ownerModerate = await rpc(
  'moderate_listing_version',
  { target_version: pendingVersion.id, decision: 'approve' },
  owner.jwt,
)
record(
  'a vendor cannot approve their own edit',
  ownerModerate.status >= 400,
  `status ${ownerModerate.status}`,
)

const noReason = await rpc(
  'moderate_listing_version',
  { target_version: pendingVersion.id, decision: 'request_changes', reason: '  ' },
  moderator.jwt,
)
record(
  'request_changes without a reason is refused',
  noReason.status >= 400 && /reason is required/i.test(noReason.body?.message ?? ''),
  noReason.body?.message ?? '',
)

const rejected = await rpc(
  'moderate_listing_version',
  {
    target_version: pendingVersion.id,
    decision: 'request_changes',
    reason: 'Please remove the pricing claim.',
  },
  moderator.jwt,
)
record('moderator can request changes', rejected.status === 200, `status ${rejected.status}`)

const afterReject = await rest(`public_vendors?select=about&id=eq.${vendor.id}`, ANON)
record(
  'rejecting an edit leaves the published version untouched',
  (afterReject.body?.[0]?.about ?? '').startsWith('ORIGINAL'),
)

const decidedTwice = await rpc(
  'moderate_listing_version',
  { target_version: pendingVersion.id, decision: 'approve' },
  moderator.jwt,
)
record(
  'a decided version cannot be decided again',
  decidedTwice.status >= 400,
  decidedTwice.body?.message ?? '',
)

// Resubmit and approve for real.
await rpc('submit_listing_for_review', { target_vendor: vendor.id }, owner.jwt)
const v3 = (
  await rest(
    `vendor_listing_versions?select=id,version_no&vendor_id=eq.${vendor.id}&status=eq.pending`,
    SVC,
  )
).body[0]
const approved = await rpc(
  'moderate_listing_version',
  { target_version: v3.id, decision: 'approve' },
  moderator.jwt,
)
record('moderator can approve', approved.status === 200, `status ${approved.status}`)

const nowLive = await rest(
  `public_vendors?select=about,published_version_no&id=eq.${vendor.id}`,
  ANON,
)
record(
  'approval publishes the new text',
  (nowLive.body?.[0]?.about ?? '').startsWith('SECRET UNREVIEWED'),
  `version ${nowLive.body?.[0]?.published_version_no}`,
)

const archived = await rest(
  `vendor_listing_versions?select=version_no,status&vendor_id=eq.${vendor.id}&order=version_no`,
  SVC,
)
record(
  'the previous published version is archived, not deleted',
  archived.body?.some((v) => v.status === 'archived'),
  archived.body?.map((v) => `${v.version_no}:${v.status}`).join(' '),
)

const nowSearchable = await rpc('search_vendors', { filters: { q: 'SECRET UNREVIEWED' } }, null)
record(
  'approved text becomes searchable',
  Array.isArray(nowSearchable.body) && nowSearchable.body.some((r) => r.vendor_id === vendor.id),
)

// ---------------------------------------------------------------------------
console.log('\nmedia moderation:')

await rest('vendor_media', SVC, {
  method: 'POST',
  body: JSON.stringify({
    vendor_id: vendor.id,
    storage_path: `${vendor.id}/pending.jpg`,
    moderation_status: 'pending',
    alt_text: 'pending image',
  }),
})
const anonPendingMedia = await rest(
  `vendor_media?select=id&vendor_id=eq.${vendor.id}&moderation_status=eq.pending`,
  ANON,
)
record(
  'anon cannot see unmoderated images',
  Array.isArray(anonPendingMedia.body) && anonPendingMedia.body.length === 0,
)

// ---------------------------------------------------------------------------
console.log('\navailability privacy:')

await rest('vendor_availability', SVC, {
  method: 'POST',
  body: JSON.stringify({
    vendor_id: vendor.id,
    start_date: '2027-01-01',
    end_date: '2027-01-05',
    status: 'unavailable',
    note_private: 'PRIVATE NOTE — another wedding booked',
  }),
})

const anonAvailability = await rest(`vendor_availability?select=note_private`, ANON)
record(
  'anon cannot read availability rows at all',
  Array.isArray(anonAvailability.body) && anonAvailability.body.length === 0,
)

const publicSignal = await rest(
  `public_vendor_availability?select=status,start_date&vendor_id=eq.${vendor.id}`,
  ANON,
)
record(
  'the public view exposes the status signal',
  Array.isArray(publicSignal.body) && publicSignal.body.length === 1,
  `rows ${publicSignal.body?.length}`,
)
record(
  'the public view has no private note column',
  Array.isArray(publicSignal.body) && !('note_private' in (publicSignal.body[0] ?? {})),
)

// ---------------------------------------------------------------------------
console.log('\nslug redirects:')

const newSlug = `${slug}-renamed`
await rest(`vendors?id=eq.${vendor.id}`, SVC, {
  method: 'PATCH',
  body: JSON.stringify({ slug: newSlug }),
})

const resolved = await rpc('resolve_slug_redirect', { kind: 'vendor', candidate: slug }, null)
record('a rename records a redirect', resolved.body === newSlug, String(resolved.body))

const finalSlug = `${slug}-final`
await rest(`vendors?id=eq.${vendor.id}`, SVC, {
  method: 'PATCH',
  body: JSON.stringify({ slug: finalSlug }),
})
const rechained = await rpc('resolve_slug_redirect', { kind: 'vendor', candidate: slug }, null)
record(
  'a second rename does not create a redirect chain',
  rechained.body === finalSlug,
  `${slug} -> ${rechained.body}`,
)

const selfRedirect = await rpc(
  'resolve_slug_redirect',
  { kind: 'vendor', candidate: finalSlug },
  null,
)
record(
  'the live slug does not redirect to itself',
  selfRedirect.body === null,
  String(selfRedirect.body),
)

// ---------------------------------------------------------------------------
console.log('\ncleaning up…')
await rest(`slug_redirects?entity_id=eq.${vendor.id}`, SVC, { method: 'DELETE' })
await rest(`audit_logs?entity_id=eq.${vendor.id}`, SVC, { method: 'DELETE' })
await rest(`vendors?id=eq.${vendor.id}`, SVC, { method: 'DELETE' })
for (const u of [owner, moderator, analyst]) {
  await rest(`admin_memberships?user_id=eq.${u.id}`, SVC, { method: 'DELETE' })
  await fetch(`${URL_BASE}/auth/v1/admin/users/${u.id}`, {
    method: 'DELETE',
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
  })
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(`  - ${f.name} (${f.detail})`)
}
process.exit(failed.length ? 1 : 0)
