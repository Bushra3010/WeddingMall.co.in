/**
 * Milestone 4 boundaries: enquiry submission, lifecycle enforcement, thread
 * privacy, and notifications (PRD 6.5-6.7, Epic C).
 *
 * Also asserts that `public.enquiry_transitions` matches the TypeScript map in
 * src/features/enquiries/status.ts — the drift check ADR-004 flagged as missing
 * for the permission catalogue, applied here to the lifecycle.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/*
 * The transition map lives in TypeScript. Node 20 cannot strip types, so it is
 * compiled with the esbuild that ships inside vite. Importing the REAL source
 * is the whole point — a hand-copied map here would pass while the app drifted.
 */
const outDir = mkdtempSync(join(tmpdir(), 'wm-status-'))
const outFile = join(outDir, 'status.mjs')
execFileSync('node_modules/esbuild/bin/esbuild', [
  'src/features/enquiries/status.ts',
  '--format=esm',
  `--outfile=${outFile}`,
])
const { checkTransition, ENQUIRY_STATUSES } = await import(outFile)

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
  const email = `m4-${tag}-${Date.now()}@example.test`
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

// ---------------------------------------------------------------------------
console.log('\ntransition map parity (SQL vs TypeScript):')

const sqlRows = (
  await rest('enquiry_transitions?select=from_status,to_status,actor_type,requires_reason', SVC)
).body

const ACTORS = ['customer', 'vendor', 'admin', 'system']
const mismatches = []

for (const from of ENQUIRY_STATUSES) {
  for (const to of ENQUIRY_STATUSES) {
    for (const actor of ACTORS) {
      const ts = checkTransition(from, to, actor)
      const sql = sqlRows.find(
        (r) => r.from_status === from && r.to_status === to && r.actor_type === actor,
      )

      if (ts.allowed !== Boolean(sql)) {
        mismatches.push(`${from}->${to} (${actor}): ts=${ts.allowed} sql=${Boolean(sql)}`)
      } else if (sql && ts.requiresReason !== sql.requires_reason) {
        mismatches.push(
          `${from}->${to} (${actor}) reason: ts=${ts.requiresReason} sql=${sql.requires_reason}`,
        )
      }
    }
  }
}

record(
  'SQL transition table matches the TypeScript map',
  mismatches.length === 0,
  mismatches.slice(0, 4).join('; ') || `${sqlRows.length} rows checked`,
)

// ---------------------------------------------------------------------------
console.log('\nfixtures…')
const alice = await createUser('alice')
const mallory = await createUser('mallory')
const owner = await createUser('owner')

const vendor = (await rest('vendors?select=id,display_name&slug=eq.marigold-courtyard', SVC))
  .body[0]
await rest('vendor_memberships', SVC, {
  method: 'POST',
  body: JSON.stringify({
    vendor_id: vendor.id,
    user_id: owner.id,
    role: 'vendor_owner',
    status: 'active',
  }),
})

// ---------------------------------------------------------------------------
console.log('\nsubmission:')

const key = `probe-${Date.now()}`
const first = await rpc(
  'submit_enquiry',
  { payload: { vendorId: vendor.id, message: 'Probe enquiry.', idempotencyKey: key } },
  alice.jwt,
)
record('customer can submit', first.status === 200 && first.body.ok, `status ${first.status}`)
const enquiryId = first.body?.enquiryId

const replay = await rpc(
  'submit_enquiry',
  { payload: { vendorId: vendor.id, message: 'Probe enquiry.', idempotencyKey: key } },
  alice.jwt,
)
record(
  'replaying the same key returns the original, not a second enquiry',
  replay.body?.enquiryId === enquiryId && replay.body?.duplicate === true,
  `same id: ${replay.body?.enquiryId === enquiryId}`,
)

const count = (
  await rest(`enquiries?select=id&customer_id=eq.${alice.id}&idempotency_key=eq.${key}`, SVC)
).body
record('exactly one row exists for that key', count.length === 1, `rows ${count.length}`)

const anon = await rpc('submit_enquiry', { payload: { vendorId: vendor.id, message: 'x' } }, null)
record('anon cannot submit', anon.status >= 400, `status ${anon.status}`)

const draftVendor = (await rest('vendors?select=id&status=eq.draft&limit=1', SVC)).body?.[0]
if (draftVendor) {
  const toDraft = await rpc(
    'submit_enquiry',
    { payload: { vendorId: draftVendor.id, message: 'Probe.' } },
    alice.jwt,
  )
  record(
    'cannot enquire to an unpublished vendor',
    toDraft.status >= 400,
    `status ${toDraft.status}`,
  )
}

// ---------------------------------------------------------------------------
console.log('\nlifecycle enforcement:')

const bypass = await rest(
  `enquiries?id=eq.${enquiryId}`,
  ANON,
  { method: 'PATCH', body: JSON.stringify({ status: 'booked' }) },
  alice.jwt,
)
const afterBypass = (await rest(`enquiries?select=status&id=eq.${enquiryId}`, SVC)).body[0]
record(
  'customer cannot PATCH status past the transition map',
  afterBypass.status === 'delivered',
  `status ${afterBypass.status} (http ${bypass.status})`,
)

const noReason = await rpc(
  'transition_enquiry',
  { target_enquiry: enquiryId, next_status: 'closed' },
  alice.jwt,
)
record(
  'a transition needing a reason is refused without one',
  noReason.status >= 400 && /reason is required/i.test(noReason.body?.message ?? ''),
  noReason.body?.message ?? '',
)

await rpc('mark_enquiry_viewed', { target_enquiry: enquiryId }, owner.jwt)
const afterViewed = (await rest(`enquiries?select=status&id=eq.${enquiryId}`, SVC)).body[0]
record(
  'vendor opening the enquiry marks it viewed',
  afterViewed.status === 'viewed',
  `status ${afterViewed.status}`,
)

const malloryTransition = await rpc(
  'transition_enquiry',
  { target_enquiry: enquiryId, next_status: 'qualified' },
  mallory.jwt,
)
record(
  'an unrelated user cannot transition it',
  malloryTransition.status >= 400,
  `status ${malloryTransition.status}`,
)

const events = (
  await rest(
    `enquiry_events?select=event_type,to_status&enquiry_id=eq.${enquiryId}&order=created_at`,
    SVC,
  )
).body
record(
  'every step wrote an event',
  events.some((e) => e.event_type === 'enquiry_submitted') &&
    events.some((e) => e.event_type === 'status_changed'),
  events.map((e) => e.event_type).join(' -> '),
)

// enquiry_events is append-only by design.
const tamper = await rest(
  `enquiry_events?enquiry_id=eq.${enquiryId}`,
  ANON,
  { method: 'DELETE' },
  alice.jwt,
)
const stillThere = (await rest(`enquiry_events?select=id&enquiry_id=eq.${enquiryId}`, SVC)).body
record(
  'a participant cannot delete lifecycle events',
  stillThere.length === events.length,
  `${stillThere.length} remain (http ${tamper.status})`,
)

// ---------------------------------------------------------------------------
console.log('\nthread privacy:')

const conversation = (await rest(`conversations?select=id&enquiry_id=eq.${enquiryId}`, SVC)).body[0]

await rest(
  'messages',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversation.id,
      sender_user_id: alice.id,
      body: 'ALICE PRIVATE MESSAGE',
    }),
  },
  alice.jwt,
)

const malloryReads = await rest(
  `messages?select=body&conversation_id=eq.${conversation.id}`,
  ANON,
  {},
  mallory.jwt,
)
record(
  'an unrelated user cannot read the thread',
  Array.isArray(malloryReads.body) && malloryReads.body.length === 0,
  `rows ${malloryReads.body?.length}`,
)

const vendorReads = await rest(
  `messages?select=body&conversation_id=eq.${conversation.id}`,
  ANON,
  {},
  owner.jwt,
)
record(
  'the vendor can read the thread',
  Array.isArray(vendorReads.body) && vendorReads.body.length === 1,
  `rows ${vendorReads.body?.length}`,
)

const spoof = await rest(
  'messages',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversation.id,
      sender_user_id: alice.id,
      body: 'SPOOFED',
    }),
  },
  mallory.jwt,
)
record('cannot post as someone else', spoof.status >= 400, `status ${spoof.status}`)

const anonThread = await rest(`messages?select=body`, ANON)
record(
  'anon cannot read any message',
  Array.isArray(anonThread.body) && anonThread.body.length === 0,
)

// ---------------------------------------------------------------------------
console.log('\nvendor reply and SLA:')

await rest(
  'messages',
  ANON,
  {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversation.id,
      sender_user_id: owner.id,
      body: 'Thanks for getting in touch.',
    }),
  },
  owner.jwt,
)

const afterReply = (await rest(`enquiries?select=first_response_at&id=eq.${enquiryId}`, SVC))
  .body[0]
record('the first vendor reply stops the SLA clock', Boolean(afterReply.first_response_at))

const aliceNotifs = (await rest(`notifications?select=code&user_id=eq.${alice.id}`, SVC)).body
record(
  'the customer is notified of the reply',
  aliceNotifs.some((n) => n.code === 'message.new'),
  aliceNotifs.map((n) => n.code).join(',') || 'none',
)

const ownerNotifs = (await rest(`notifications?select=code&user_id=eq.${owner.id}`, SVC)).body
record(
  'the vendor was notified of the enquiry',
  ownerNotifs.some((n) => n.code === 'enquiry.new'),
  ownerNotifs.map((n) => n.code).join(',') || 'none',
)

const malloryNotifs = await rest('notifications?select=id', ANON, {}, mallory.jwt)
record(
  'a user sees only their own notifications',
  Array.isArray(malloryNotifs.body) && malloryNotifs.body.length === 0,
)

// ---------------------------------------------------------------------------
console.log('\nshortlist and wedding profile privacy:')

await rest(
  'shortlists',
  ANON,
  { method: 'POST', body: JSON.stringify({ vendor_id: vendor.id, note: 'ALICE NOTE' }) },
  alice.jwt,
)

const malloryShortlist = await rest('shortlists?select=note', ANON, {}, mallory.jwt)
record(
  "another customer cannot see Alice's shortlist",
  Array.isArray(malloryShortlist.body) && malloryShortlist.body.length === 0,
)

const vendorShortlist = await rest('shortlists?select=note', ANON, {}, owner.jwt)
record(
  'a vendor cannot see who shortlisted them',
  Array.isArray(vendorShortlist.body) && vendorShortlist.body.length === 0,
)

const dupe = await rest(
  'shortlists',
  ANON,
  { method: 'POST', body: JSON.stringify({ vendor_id: vendor.id }) },
  alice.jwt,
)
record('shortlist entries are unique per vendor', dupe.status >= 400, `status ${dupe.status}`)

// ---------------------------------------------------------------------------
console.log('\ncontact consent:')

const consented = (await rest(`enquiries?select=contact_consent&id=eq.${enquiryId}`, SVC)).body[0]
record(
  'consent defaults to false when not given',
  consented.contact_consent === false,
  String(consented.contact_consent),
)

// ---------------------------------------------------------------------------
console.log('\ncleaning up…')
await rest(`shortlists?vendor_id=eq.${vendor.id}`, SVC, { method: 'DELETE' })
await rest(`enquiries?id=eq.${enquiryId}`, SVC, { method: 'DELETE' })
await rest(`enquiries?customer_id=eq.${alice.id}`, SVC, { method: 'DELETE' })
await rest(`vendor_memberships?user_id=eq.${owner.id}`, SVC, { method: 'DELETE' })
for (const u of [alice, mallory, owner]) {
  await rest(`notifications?user_id=eq.${u.id}`, SVC, { method: 'DELETE' })
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
