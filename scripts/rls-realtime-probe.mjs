/**
 * Realtime is a second read path into `messages` (PRD 6.7).
 *
 * "Realtime channel access must be private and membership-authorised." A
 * subscriber who is not a participant must receive *nothing* — not merely be
 * unable to fetch the message afterwards. Realtime evaluates the table's RLS
 * policies before delivering a change, so `messages: participant read` is what
 * protects the stream; this asserts that rather than trusting it.
 *
 * Both directions, as always. "The outsider received nothing" is worthless on
 * its own — it also passes when Realtime is switched off entirely, which is
 * exactly the state this migration changed. The participant assertion is what
 * makes the outsider assertion mean something.
 */
import WebSocket from 'ws'
import { createClient } from '@supabase/supabase-js'

// Node 20 has no global WebSocket; realtime-js needs one supplied.
globalThis.WebSocket ??= WebSocket

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
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

async function createUser(tag) {
  const email = `rt-${tag}-${Date.now()}@example.test`
  const password = 'ProbePassword123!'
  const user = await (
    await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json()
  return { id: user.id, email, password }
}

/**
 * Subscribes and collects message bodies until `stop()` is called.
 *
 * The client signs in for itself rather than being handed a bearer header.
 * A header on the REST transport does not authenticate the WebSocket, so a
 * header-only client subscribes successfully and is then filtered out of
 * every row — which looks exactly like RLS working and is not.
 */
async function watch(account) {
  const client = createClient(URL_BASE, ANON, {
    realtime: { params: { eventsPerSecond: 10 } },
  })

  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  })
  if (error) throw new Error(`sign-in failed: ${error.message}`)

  const received = []
  const channel = client
    .channel(`probe-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => received.push(payload.new?.body ?? '(no body)'),
    )

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('subscribe timed out')), 15000)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve()
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(status))
      }
    })
  })

  return {
    received,
    stop: async () => {
      await client.removeChannel(channel)
      await client.auth.signOut()
      client.realtime.disconnect()
    },
  }
}

const cleanup = []

try {
  const customer = await createUser('participant')
  const outsider = await createUser('outsider')
  cleanup.push(() =>
    Promise.all(
      [customer.id, outsider.id].map((id) =>
        fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
          method: 'DELETE',
          headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
        }),
      ),
    ),
  )

  const vendor = (await rest('vendors?select=id&status=eq.active&limit=1', SVC)).body[0]

  const enquiry = (
    await rest('enquiries', SVC, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        customer_id: customer.id,
        vendor_id: vendor.id,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        message: 'realtime probe',
      }),
    })
  ).body[0]

  const conversation = (
    await rest('conversations', SVC, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ enquiry_id: enquiry.id }),
    })
  ).body[0]

  cleanup.push(() => rest(`messages?conversation_id=eq.${conversation.id}`, SVC, { method: 'DELETE' }))
  cleanup.push(() => rest(`conversations?id=eq.${conversation.id}`, SVC, { method: 'DELETE' }))
  cleanup.push(() => rest(`enquiries?id=eq.${enquiry.id}`, SVC, { method: 'DELETE' }))

  console.log('\nrealtime delivery:')

  const participant = await watch(customer)
  const stranger = await watch(outsider)

  const body = `probe message ${Date.now()}`
  await rest('messages', SVC, {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversation.id,
      sender_user_id: customer.id,
      body,
    }),
  })

  /*
   * Poll until the participant sees it, rather than sleeping a fixed time.
   *
   * A flat 4-second wait failed intermittently under load — and a flaky
   * security probe is worse than none, because the first instinct on a red run
   * is to re-run it rather than read it. This waits for the condition and
   * gives up at 15 seconds, so a real regression still fails.
   */
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline && !participant.received.includes(body)) {
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  // A moment more, so a wrongly-delivered event has time to arrive too — the
  // outsider assertion must not pass merely by being read early.
  await new Promise((resolve) => setTimeout(resolve, 1500))

  await participant.stop()
  await stranger.stop()

  record(
    'a participant receives the message',
    participant.received.includes(body),
    `${participant.received.length} event(s)`,
  )
  record(
    'a non-participant receives nothing',
    stranger.received.length === 0,
    `${stranger.received.length} event(s)`,
  )
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
