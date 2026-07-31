/**
 * Cross-tenant RLS isolation (PRD Epic C: "customer cannot read another
 * customer's data"; Epic D: membership role limits database operations).
 *
 * This is the probe that matters. Anon denial is easy; the real risk is an
 * authenticated user reading a peer's rows. Every request below carries a REAL
 * user JWT, so the policies are exercised exactly as they would be in the app.
 *
 * Fixtures are created so each "denied" result means a row genuinely existed
 * and was withheld — never that the table happened to be empty.
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

async function createUser(tag) {
  const email = `probe-${tag}-${Date.now()}@example.test`
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
  if (!token.access_token) throw new Error(`sign-in failed: ${JSON.stringify(token)}`)
  return { id: user.id, jwt: token.access_token, email }
}

console.log('\ncreating two customers and one vendor…')
const alice = await createUser('alice')
const mallory = await createUser('mallory')
const vendorOwner = await createUser('owner')
const outsider = await createUser('outsider')
console.log(`  alice    ${alice.id}`)
console.log(`  mallory  ${mallory.id}`)
console.log(`  owner    ${vendorOwner.id}`)
console.log(`  outsider ${outsider.id}`)

const cityId = (await rest('cities?select=id&limit=1', SVC)).body?.[0]?.id
const categoryId = (await rest('categories?select=id&slug=eq.photographers', SVC)).body?.[0]?.id

const vendor = (
  await rest('vendors', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      display_name: 'Tenant Probe Studio',
      slug: `tenant-probe-${Date.now()}`,
      owner_user_id: vendorOwner.id,
      status: 'active',
      primary_city_id: cityId,
      published_at: new Date().toISOString(),
    }),
  })
).body?.[0]

await rest('vendor_listings', SVC, {
  method: 'POST',
  body: JSON.stringify({ vendor_id: vendor.id, status: 'approved', about: 'Tenant probe.' }),
})
await rest('vendor_memberships', SVC, {
  method: 'POST',
  body: JSON.stringify({
    vendor_id: vendor.id,
    user_id: vendorOwner.id,
    role: 'vendor_owner',
    status: 'active',
  }),
})

// Alice's private data.
const aliceEnquiry = (
  await rest('enquiries', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      customer_id: alice.id,
      vendor_id: vendor.id,
      category_id: categoryId,
      city_id: cityId,
      message: 'ALICE PRIVATE REQUIREMENTS',
      status: 'delivered',
      contact_consent: true,
      delivered_at: new Date().toISOString(),
    }),
  })
).body?.[0]

const conversation = (
  await rest('conversations', SVC, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ enquiry_id: aliceEnquiry.id, status: 'open' }),
  })
).body?.[0]

await rest('messages', SVC, {
  method: 'POST',
  body: JSON.stringify({
    conversation_id: conversation.id,
    sender_user_id: alice.id,
    body: 'ALICE PRIVATE MESSAGE',
  }),
})
await rest('shortlists', SVC, {
  method: 'POST',
  body: JSON.stringify({ user_id: alice.id, vendor_id: vendor.id, note: 'ALICE PRIVATE NOTE' }),
})
await rest('wedding_profiles', SVC, {
  method: 'POST',
  body: JSON.stringify({ user_id: alice.id, display_label: 'ALICE WEDDING', guest_count: 300 }),
})
await rest('enquiry_notes', SVC, {
  method: 'POST',
  body: JSON.stringify({
    enquiry_id: aliceEnquiry.id,
    vendor_id: vendor.id,
    author_user_id: vendorOwner.id,
    note: 'VENDOR INTERNAL NOTE',
  }),
})

console.log('\nAlice can reach her own data:')
for (const [label, path] of [
  ['own enquiry', `enquiries?select=id,message&id=eq.${aliceEnquiry.id}`],
  ['own shortlist', 'shortlists?select=id,note'],
  ['own wedding profile', 'wedding_profiles?select=id,display_label'],
  ['own conversation', `conversations?select=id&enquiry_id=eq.${aliceEnquiry.id}`],
  ['own messages', `messages?select=id,body&conversation_id=eq.${conversation.id}`],
  ['own profile row', `profiles?select=id&id=eq.${alice.id}`],
]) {
  const r = await rest(path, ANON, {}, alice.jwt)
  record(label, Array.isArray(r.body) && r.body.length > 0, `rows ${r.body?.length ?? 'n/a'}`)
}

console.log("\nMallory (signed in) must NOT reach Alice's data:")
for (const [label, path] of [
  ["Alice's enquiry", `enquiries?select=id,message&id=eq.${aliceEnquiry.id}`],
  ["Alice's shortlist", 'shortlists?select=id,note'],
  ["Alice's wedding profile", 'wedding_profiles?select=id,display_label'],
  ["Alice's conversation", `conversations?select=id&enquiry_id=eq.${aliceEnquiry.id}`],
  ["Alice's messages", `messages?select=id,body&conversation_id=eq.${conversation.id}`],
  ["Alice's profile row", `profiles?select=id&id=eq.${alice.id}`],
  ['vendor internal notes', `enquiry_notes?select=id,note&enquiry_id=eq.${aliceEnquiry.id}`],
]) {
  const r = await rest(path, ANON, {}, mallory.jwt)
  const denied = Array.isArray(r.body) && r.body.length === 0
  record(label, denied, `rows ${Array.isArray(r.body) ? r.body.length : JSON.stringify(r.body)}`)
}

console.log('\nMallory must not WRITE into Alice’s world:')
const hijack = await rest(
  `enquiries?id=eq.${aliceEnquiry.id}`,
  ANON,
  { method: 'PATCH', body: JSON.stringify({ status: 'spam' }) },
  mallory.jwt,
)
const hijackCheck = await rest(`enquiries?select=status&id=eq.${aliceEnquiry.id}`, SVC)
record(
  "cannot change Alice's enquiry status",
  hijackCheck.body?.[0]?.status === 'delivered',
  `status now ${hijackCheck.body?.[0]?.status} (http ${hijack.status})`,
)

const injectMsg = await rest(
  'messages',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversation.id,
      sender_user_id: mallory.id,
      body: 'INJECTED',
    }),
  },
  mallory.jwt,
)
record(
  'cannot post into a thread they are not in',
  injectMsg.status >= 400,
  `status ${injectMsg.status}`,
)

const spoof = await rest(
  'messages',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversation.id,
      sender_user_id: alice.id,
      body: 'SPOOFED AS ALICE',
    }),
  },
  mallory.jwt,
)
record('cannot forge another user as sender', spoof.status >= 400, `status ${spoof.status}`)

const fakeReview = await rest(
  'reviews',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({
      enquiry_id: aliceEnquiry.id,
      customer_id: mallory.id,
      vendor_id: vendor.id,
      overall_rating: 1,
      body: 'ineligible review',
    }),
  },
  mallory.jwt,
)
record(
  'cannot review via an enquiry they do not own',
  fakeReview.status >= 400,
  `status ${fakeReview.status}`,
)

console.log('\nVendor member boundaries:')
const ownerSees = await rest(
  `enquiries?select=id,message&id=eq.${aliceEnquiry.id}`,
  ANON,
  {},
  vendorOwner.jwt,
)
record(
  'vendor owner sees the enquiry addressed to them',
  Array.isArray(ownerSees.body) && ownerSees.body.length === 1,
  `rows ${ownerSees.body?.length ?? 'n/a'}`,
)

const ownerNotes = await rest(
  `enquiry_notes?select=id,note&enquiry_id=eq.${aliceEnquiry.id}`,
  ANON,
  {},
  vendorOwner.jwt,
)
record(
  'vendor owner sees their internal notes',
  Array.isArray(ownerNotes.body) && ownerNotes.body.length === 1,
)

const aliceNotes = await rest(
  `enquiry_notes?select=id,note&enquiry_id=eq.${aliceEnquiry.id}`,
  ANON,
  {},
  alice.jwt,
)
record(
  'customer never sees vendor internal notes',
  Array.isArray(aliceNotes.body) && aliceNotes.body.length === 0,
  `rows ${Array.isArray(aliceNotes.body) ? aliceNotes.body.length : 'n/a'}`,
)

const outsiderVendor = await rest(
  `enquiries?select=id&id=eq.${aliceEnquiry.id}`,
  ANON,
  {},
  outsider.jwt,
)
record(
  'non-member cannot read vendor leads',
  Array.isArray(outsiderVendor.body) && outsiderVendor.body.length === 0,
)

const outsiderEdit = await rest(
  `vendors?id=eq.${vendor.id}`,
  ANON,
  { method: 'PATCH', body: JSON.stringify({ display_name: 'HIJACKED' }) },
  outsider.jwt,
)
const editCheck = await rest(`vendors?select=display_name&id=eq.${vendor.id}`, SVC)
record(
  'non-member cannot edit the vendor',
  editCheck.body?.[0]?.display_name !== 'HIJACKED',
  `name now "${editCheck.body?.[0]?.display_name}" (http ${outsiderEdit.status})`,
)

console.log('\nPrivilege escalation:')
const roleId = (await rest('admin_roles?select=id&code=eq.super_admin', SVC)).body?.[0]?.id
const escalate = await rest(
  'admin_memberships',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({ user_id: mallory.id, role_id: roleId, status: 'active' }),
  },
  mallory.jwt,
)
record(
  'signed-in user cannot self-grant super_admin',
  escalate.status >= 400,
  `status ${escalate.status}`,
)

const selfMembership = await rest(
  'vendor_memberships',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({
      vendor_id: vendor.id,
      user_id: outsider.id,
      role: 'vendor_owner',
      status: 'active',
    }),
  },
  outsider.jwt,
)
record(
  'outsider cannot join a vendor team',
  selfMembership.status >= 400,
  `status ${selfMembership.status}`,
)

console.log('\ncleaning up…')
await rest(`enquiry_notes?enquiry_id=eq.${aliceEnquiry.id}`, SVC, { method: 'DELETE' })
await rest(`messages?conversation_id=eq.${conversation.id}`, SVC, { method: 'DELETE' })
await rest(`conversations?id=eq.${conversation.id}`, SVC, { method: 'DELETE' })
await rest(`enquiries?id=eq.${aliceEnquiry.id}`, SVC, { method: 'DELETE' })
await rest(`shortlists?vendor_id=eq.${vendor.id}`, SVC, { method: 'DELETE' })
await rest(`wedding_profiles?user_id=eq.${alice.id}`, SVC, { method: 'DELETE' })
await rest(`vendor_memberships?vendor_id=eq.${vendor.id}`, SVC, { method: 'DELETE' })
await rest(`vendors?id=eq.${vendor.id}`, SVC, { method: 'DELETE' })
for (const u of [alice, mallory, vendorOwner, outsider]) {
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
