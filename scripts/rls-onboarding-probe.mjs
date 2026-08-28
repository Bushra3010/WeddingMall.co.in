/**
 * Milestone 2 boundaries: onboarding, membership roles, private documents, and
 * admin moderation (PRD Epic D/E).
 *
 * Every probe runs over PostgREST with a real JWT. Fixtures are created first,
 * so a "denied" result means a row genuinely existed and was withheld.
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
  const email = `m2-${tag}-${Date.now()}@example.test`
  const password = 'ProbePassword123!'
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const user = await res.json()
  if (!user.id) throw new Error(`create user failed: ${JSON.stringify(user)}`)

  const tokenRes = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const token = await tokenRes.json()
  return { id: user.id, email, jwt: token.access_token }
}

async function grantAdminRole(userId, roleCode) {
  const role = (await rest(`admin_roles?select=id&code=eq.${roleCode}`, SVC)).body?.[0]
  await rest('admin_memberships', SVC, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role_id: role.id, status: 'active' }),
  })
}

console.log('\ncreating fixtures…')
const owner = await createUser('owner')
const editor = await createUser('editor')
const outsider = await createUser('outsider')
const verifier = await createUser('verifier')
const analyst = await createUser('analyst')
await grantAdminRole(verifier.id, 'vendor_verifier')
await grantAdminRole(analyst.id, 'analyst')

const city = (await rest('cities?select=id&slug=eq.jaipur', SVC)).body?.[0]
const category = (await rest('categories?select=id&slug=eq.venues', SVC)).body?.[0]

// ---------------------------------------------------------------------------
console.log('\nonboarding (the deadlock fixed in migration 0008):')

const slug = `m2-probe-${Date.now()}`
const created = await rest(
  'vendors',
  ANON,
  {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      display_name: 'M2 Probe Venue',
      slug,
      owner_user_id: owner.id,
      status: 'draft',
      primary_city_id: city?.id,
    }),
  },
  owner.jwt,
)
record(
  'owner can create and read back a draft vendor',
  created.status === 201 && Array.isArray(created.body) && created.body.length === 1,
  `status ${created.status}`,
)

const vendorId = created.body?.[0]?.id
if (!vendorId) {
  console.log('\ncannot continue without a vendor row')
  process.exit(1)
}

/*
 * Migration 0035 widened `vendors: create own` from `status = 'draft'` to
 * `status in ('draft', 'pending_review')` so a registration reaches the review
 * queue instead of a private draft nobody watches.
 *
 * Both halves of that are probed. The second is the one that matters: the
 * policy is the only thing standing between "apply for review" and "publish
 * yourself", and a widened check is exactly the kind of change that quietly
 * becomes `true` on the next edit.
 */
const registered = await rest(
  'vendors',
  ANON,
  {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      display_name: 'M2 Probe Applicant',
      slug: `${slug}-applicant`,
      owner_user_id: owner.id,
      status: 'pending_review',
      submitted_at: new Date().toISOString(),
      primary_city_id: city?.id,
    }),
  },
  owner.jwt,
)
record(
  'owner can register a vendor straight into the review queue',
  registered.status === 201,
  `status ${registered.status}`,
)
const applicantId = registered.body?.[0]?.id

const selfPublish = await rest(
  'vendors',
  ANON,
  {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      display_name: 'M2 Probe Self Publish',
      slug: `${slug}-self-publish`,
      owner_user_id: owner.id,
      status: 'active',
      primary_city_id: city?.id,
    }),
  },
  owner.jwt,
)
record(
  'owner cannot register a vendor as already live',
  selfPublish.status >= 400,
  `status ${selfPublish.status}`,
)

const selfVerify = await rest(
  'vendors',
  ANON,
  {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      display_name: 'M2 Probe Self Verify',
      slug: `${slug}-self-verify`,
      owner_user_id: owner.id,
      status: 'suspended',
      primary_city_id: city?.id,
    }),
  },
  owner.jwt,
)
record(
  'owner cannot register a vendor into any other status',
  selfVerify.status >= 400,
  `status ${selfVerify.status}`,
)

const bootstrap = await rest(
  'vendor_memberships',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({
      vendor_id: vendorId,
      user_id: owner.id,
      role: 'vendor_owner',
      status: 'active',
    }),
  },
  owner.jwt,
)
record(
  'owner can bootstrap their own membership',
  bootstrap.status === 201,
  `status ${bootstrap.status}`,
)

// The bootstrap policy must not become a way to join someone else's business.
const hijack = await rest(
  'vendor_memberships',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({
      vendor_id: vendorId,
      user_id: outsider.id,
      role: 'vendor_owner',
      status: 'active',
    }),
  },
  outsider.jwt,
)
record(
  'outsider cannot bootstrap into a vendor they do not own',
  hijack.status >= 400,
  `status ${hijack.status}`,
)

await rest(
  'vendor_listings',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({ vendor_id: vendorId, status: 'draft', about: 'A'.repeat(60) }),
  },
  owner.jwt,
)
await rest(
  'vendor_categories',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({ vendor_id: vendorId, category_id: category.id, is_primary: true }),
  },
  owner.jwt,
)
await rest(
  'vendor_service_areas',
  ANON,
  { method: 'POST', body: JSON.stringify({ vendor_id: vendorId, city_id: city.id }) },
  owner.jwt,
)

// ---------------------------------------------------------------------------
console.log('\ndraft privacy:')

const anonDraft = await rest(`vendors?select=id&id=eq.${vendorId}`, ANON)
record(
  'anon cannot see a draft vendor',
  Array.isArray(anonDraft.body) && anonDraft.body.length === 0,
)

const anonDraftListing = await rest(`vendor_listings?select=id&vendor_id=eq.${vendorId}`, ANON)
record(
  'anon cannot see a draft listing',
  Array.isArray(anonDraftListing.body) && anonDraftListing.body.length === 0,
)

const outsiderDraft = await rest(`vendors?select=id&id=eq.${vendorId}`, ANON, {}, outsider.jwt)
record(
  'another signed-in user cannot see the draft',
  Array.isArray(outsiderDraft.body) && outsiderDraft.body.length === 0,
)

// ---------------------------------------------------------------------------
console.log('\nsubmission gate:')

const outsiderSubmit = await rpc(
  'submit_vendor_for_review',
  { target_vendor: vendorId },
  outsider.jwt,
)
record('non-member cannot submit', outsiderSubmit.status >= 400, `status ${outsiderSubmit.status}`)

const submit = await rpc('submit_vendor_for_review', { target_vendor: vendorId }, owner.jwt)
record('owner can submit a complete profile', submit.status === 200, `status ${submit.status}`)

const doubleSubmit = await rpc('submit_vendor_for_review', { target_vendor: vendorId }, owner.jwt)
record(
  'resubmitting while pending is rejected',
  doubleSubmit.status >= 400 && /already awaiting/i.test(doubleSubmit.body?.message ?? ''),
  doubleSubmit.body?.message ?? '',
)

// Submission alone must not publish anything.
const publishedEarly = await rest(`public_vendors?select=id&id=eq.${vendorId}`, ANON)
record(
  'submitting does not publish the listing',
  Array.isArray(publishedEarly.body) && publishedEarly.body.length === 0,
)

// ---------------------------------------------------------------------------
console.log('\nmembership roles:')

await rest('vendor_memberships', SVC, {
  method: 'POST',
  body: JSON.stringify({
    vendor_id: vendorId,
    user_id: editor.id,
    role: 'vendor_editor',
    status: 'active',
  }),
})

const editorEdit = await rest(
  `vendor_listings?vendor_id=eq.${vendorId}`,
  ANON,
  { method: 'PATCH', body: JSON.stringify({ about: 'B'.repeat(60) }) },
  editor.jwt,
)
const editorCheck = await rest(`vendor_listings?select=about&vendor_id=eq.${vendorId}`, SVC)
record(
  'editor can edit the listing',
  editorCheck.body?.[0]?.about?.startsWith('B'),
  `status ${editorEdit.status}`,
)

const editorInvite = await rpc(
  'invite_vendor_member',
  { target_vendor: vendorId, invitee_email: outsider.email, member_role: 'vendor_sales' },
  editor.jwt,
)
record(
  'editor cannot invite team members',
  editorInvite.status >= 400,
  `status ${editorInvite.status}`,
)

const editorSubmit = await rpc('submit_vendor_for_review', { target_vendor: vendorId }, editor.jwt)
record(
  'editor cannot submit for review',
  editorSubmit.status >= 400,
  `status ${editorSubmit.status}`,
)

// Role ceiling: only an owner may mint another owner.
await rest('vendor_memberships', SVC, {
  method: 'POST',
  body: JSON.stringify({
    vendor_id: vendorId,
    user_id: outsider.id,
    role: 'vendor_manager',
    status: 'active',
  }),
})
const managerMakesOwner = await rpc(
  'invite_vendor_member',
  { target_vendor: vendorId, invitee_email: analyst.email, member_role: 'vendor_owner' },
  outsider.jwt,
)
record(
  'manager cannot mint an owner',
  managerMakesOwner.status >= 400,
  managerMakesOwner.body?.message ?? `status ${managerMakesOwner.status}`,
)

// ---------------------------------------------------------------------------
// Regression guard for migration 0010. Found by driving the admin UI: the queue
// showed "Category: —" because an admin could not read the child tables of a
// pending vendor. An admin asked to approve a listing must be able to see it.
console.log('\nadmin can review what it is approving:')

for (const [label, path] of [
  [
    'categories of a pending vendor',
    `vendor_categories?select=is_primary&vendor_id=eq.${vendorId}`,
  ],
  [
    'service areas of a pending vendor',
    `vendor_service_areas?select=city_id&vendor_id=eq.${vendorId}`,
  ],
]) {
  const r = await rest(path, ANON, {}, verifier.jwt)
  record(
    `admin can read ${label}`,
    Array.isArray(r.body) && r.body.length > 0,
    `rows ${r.body?.length}`,
  )
}

// The same rows must still be invisible to the public while in review.
const anonCategories = await rest(
  `vendor_categories?select=is_primary&vendor_id=eq.${vendorId}`,
  ANON,
)
record(
  'anon still cannot read a pending vendor’s categories',
  Array.isArray(anonCategories.body) && anonCategories.body.length === 0,
)

// ---------------------------------------------------------------------------
console.log('\nprivate verification documents:')

const verification = (
  await rest(`vendor_verifications?select=id&vendor_id=eq.${vendorId}&status=eq.pending`, SVC)
).body?.[0]

await rest('vendor_documents', SVC, {
  method: 'POST',
  body: JSON.stringify({
    verification_id: verification.id,
    storage_path: `${vendorId}/probe.pdf`,
    document_type: 'gst',
  }),
})

const anonDocs = await rest('vendor_documents?select=id', ANON)
record('anon cannot read documents', Array.isArray(anonDocs.body) && anonDocs.body.length === 0)

const outsiderDocs = await rest('vendor_documents?select=id', ANON, {}, outsider.jwt)
record(
  'a manager on the vendor can read its documents',
  Array.isArray(outsiderDocs.body) && outsiderDocs.body.length === 1,
  `rows ${outsiderDocs.body?.length}`,
)

const editorDocs = await rest('vendor_documents?select=id', ANON, {}, editor.jwt)
record(
  'an editor cannot read verification documents',
  Array.isArray(editorDocs.body) && editorDocs.body.length === 0,
  `rows ${editorDocs.body?.length}`,
)

const analystDocs = await rest('vendor_documents?select=id', ANON, {}, analyst.jwt)
record(
  'an admin without vendor.verify cannot read documents',
  Array.isArray(analystDocs.body) && analystDocs.body.length === 0,
  `rows ${analystDocs.body?.length}`,
)

/*
 * Scoped to this probe's own vendor, not a global count.
 *
 * This asserted `length === 1` and broke the day a real vendor uploaded a
 * document — the probe was measuring the whole table. An assertion about
 * whether a verifier can read *a* document must not depend on how many other
 * documents happen to exist.
 */
const verifierDocs = await rest(
  // `vendor_documents` has no `vendor_id` — it hangs off `verification_id`.
  // Filtering on a column that does not exist returned HTTP 400, which the
  // assertion read as "no rows" and reported as a permission failure.
  `vendor_documents?select=id&verification_id=eq.${verification.id}`,
  ANON,
  {},
  verifier.jwt,
)
record(
  'an admin with vendor.verify can read documents',
  Array.isArray(verifierDocs.body) && verifierDocs.body.length >= 1,
  Array.isArray(verifierDocs.body)
    ? `rows ${verifierDocs.body.length}`
    : `HTTP ${verifierDocs.status} ${JSON.stringify(verifierDocs.body).slice(0, 160)}`,
)

const objectFetch = await fetch(
  `${URL_BASE}/storage/v1/object/vendor-documents/${vendorId}/probe.pdf`,
  { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
)
record(
  'private bucket object is not publicly fetchable',
  objectFetch.status >= 400,
  `status ${objectFetch.status}`,
)

// ---------------------------------------------------------------------------
console.log('\nadmin decisions:')

const analystDecide = await rpc(
  'admin_decide_vendor',
  { target_vendor: vendorId, decision: 'approve' },
  analyst.jwt,
)
record(
  'admin without vendor.verify cannot approve',
  analystDecide.status >= 400,
  `status ${analystDecide.status}`,
)

const ownerDecide = await rpc(
  'admin_decide_vendor',
  { target_vendor: vendorId, decision: 'approve' },
  owner.jwt,
)
record(
  'vendor cannot approve themselves',
  ownerDecide.status >= 400,
  `status ${ownerDecide.status}`,
)

const noReason = await rpc(
  'admin_decide_vendor',
  { target_vendor: vendorId, decision: 'request_changes', reason: '   ' },
  verifier.jwt,
)
record(
  'a decision needing a reason is refused without one',
  noReason.status >= 400 && /reason is required/i.test(noReason.body?.message ?? ''),
  noReason.body?.message ?? '',
)

const changes = await rpc(
  'admin_decide_vendor',
  {
    target_vendor: vendorId,
    decision: 'request_changes',
    reason: 'Please upload a clearer GST certificate.',
  },
  verifier.jwt,
)
record('verifier can request changes', changes.status === 200, `status ${changes.status}`)

const afterChanges = (await rest(`vendors?select=status,rejection_reason&id=eq.${vendorId}`, SVC))
  .body?.[0]
record(
  'requesting changes returns the vendor to draft with the reason attached',
  afterChanges?.status === 'draft' && Boolean(afterChanges?.rejection_reason),
  `${afterChanges?.status}: ${afterChanges?.rejection_reason}`,
)

await rpc('submit_vendor_for_review', { target_vendor: vendorId }, owner.jwt)
const approve = await rpc(
  'admin_decide_vendor',
  { target_vendor: vendorId, decision: 'approve' },
  verifier.jwt,
)
record('verifier can approve', approve.status === 200, `status ${approve.status}`)

const nowPublic = await rest(`public_vendors?select=id&id=eq.${vendorId}`, ANON)
record(
  'approval publishes the listing',
  Array.isArray(nowPublic.body) && nowPublic.body.length === 1,
)

const searchable = await rpc('search_vendors', { filters: { q: 'M2 Probe Venue' } }, null)
record(
  'approval makes the vendor searchable',
  Array.isArray(searchable.body) && searchable.body.some((r) => r.vendor_id === vendorId),
)

const suspendByVerifier = await rpc(
  'admin_decide_vendor',
  { target_vendor: vendorId, decision: 'suspend', reason: 'test' },
  verifier.jwt,
)
record(
  'vendor.verify alone cannot suspend',
  suspendByVerifier.status >= 400,
  `status ${suspendByVerifier.status}`,
)

// ---------------------------------------------------------------------------
console.log('\naudit trail:')

const audit = (
  await rest(`audit_logs?select=action,reason&entity_id=eq.${vendorId}&order=created_at`, SVC)
).body

record('every decision is recorded', audit.length >= 4, audit.map((a) => a.action).join(' -> '))
record(
  'the reason is stored with the decision',
  audit.some((a) => a.action === 'vendor.request_changes' && a.reason),
)

const vendorReadsAudit = await rest(
  `audit_logs?select=id&entity_id=eq.${vendorId}`,
  ANON,
  {},
  owner.jwt,
)
record(
  'a vendor cannot read the audit log',
  Array.isArray(vendorReadsAudit.body) && vendorReadsAudit.body.length === 0,
)

const verifierReadsAudit = await rest(
  `audit_logs?select=id&entity_id=eq.${vendorId}`,
  ANON,
  {},
  verifier.jwt,
)
record(
  'an admin without admin.manage cannot read the audit log',
  Array.isArray(verifierReadsAudit.body) && verifierReadsAudit.body.length === 0,
)

// ---------------------------------------------------------------------------
console.log('\ntaxonomy:')

const outsiderCategory = await rest(
  'categories',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({ name: 'Injected', slug: `injected-${Date.now()}` }),
  },
  outsider.jwt,
)
record(
  'a normal user cannot create a category',
  outsiderCategory.status >= 400,
  `status ${outsiderCategory.status}`,
)

const verifierCategory = await rest(
  'categories',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({ name: 'Injected', slug: `injected-${Date.now()}` }),
  },
  verifier.jwt,
)
record(
  'an admin without taxonomy permission cannot create a category',
  verifierCategory.status >= 400,
  `status ${verifierCategory.status}`,
)

// ---------------------------------------------------------------------------
console.log('\ncleaning up…')
await rest(`audit_logs?entity_id=eq.${vendorId}`, SVC, { method: 'DELETE' })
await rest(`vendors?id=eq.${vendorId}`, SVC, { method: 'DELETE' })
if (applicantId) {
  await rest(`audit_logs?entity_id=eq.${applicantId}`, SVC, { method: 'DELETE' })
  await rest(`vendors?id=eq.${applicantId}`, SVC, { method: 'DELETE' })
}
for (const u of [owner, editor, outsider, verifier, analyst]) {
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
