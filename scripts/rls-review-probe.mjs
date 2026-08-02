/**
 * Milestone 5 boundaries: review eligibility, moderation integrity, the edit
 * window, revision history, and vendor responses (PRD 6.8).
 *
 * Every assertion runs over PostgREST with a real JWT, so it exercises the
 * same path an attacker would. Both directions are asserted — denied *and*
 * permitted — because "nobody can do X" passes trivially when the feature is
 * broken for everyone, which has hidden bugs in three previous milestones
 * (ADR-013, ADR-021).
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
  const email = `m5-${tag}-${Date.now()}@example.test`
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

/** Grants an existing user an admin role, so the probe exercises the real
 *  permission path rather than the service role's blanket bypass. */
async function makeAdmin(userId, roleCode) {
  const role = (await rest(`admin_roles?select=id&code=eq.${roleCode}`, SVC)).body[0]
  await rest('admin_memberships', SVC, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role_id: role.id, status: 'active' }),
  })
}

async function makeVendorMember(userId, vendorId, role = 'vendor_owner') {
  await rest('vendor_memberships', SVC, {
    method: 'POST',
    body: JSON.stringify({ vendor_id: vendorId, user_id: userId, role, status: 'active' }),
  })
}

const cleanup = []

try {
  const customer = await createUser('customer')
  cleanup.push(() =>
    fetch(`${URL_BASE}/auth/v1/admin/users/${customer.id}`, {
      method: 'DELETE',
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    }),
  )

  const vendor = (
    await rest(
      'vendors?select=id,slug,rating_average,rating_count&status=eq.active&limit=1',
      SVC,
    )
  ).body[0]
  const ratingBefore = { avg: vendor.rating_average, count: vendor.rating_count }
  // The seeded ratings are denormalised and not backed by review rows, so the
  // approval trigger will recompute them from scratch. Restored at the end.
  cleanup.push(() =>
    rest(`vendors?id=eq.${vendor.id}`, SVC, {
      method: 'PATCH',
      body: JSON.stringify({ rating_average: ratingBefore.avg, rating_count: ratingBefore.count }),
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

  const vendorUser = await createUser('vendoruser')
  await makeVendorMember(vendorUser.id, vendor.id)
  cleanup.push(() =>
    fetch(`${URL_BASE}/auth/v1/admin/users/${vendorUser.id}`, {
      method: 'DELETE',
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    }),
  )

  const mkEnquiry = async (status) =>
    (
      await rest('enquiries', SVC, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          customer_id: customer.id,
          vendor_id: vendor.id,
          status,
          message: 'rls probe',
        }),
      })
    ).body[0]

  const draft = await mkEnquiry('draft')
  const booked = await mkEnquiry('booked')
  cleanup.push(() => rest(`enquiries?id=in.(${draft.id},${booked.id})`, SVC, { method: 'DELETE' }))

  console.log('\nreview eligibility:')

  const offDraft = await rest(
    'reviews',
    ANON,
    {
      method: 'POST',
      body: JSON.stringify({
        enquiry_id: draft.id,
        customer_id: customer.id,
        vendor_id: vendor.id,
        overall_rating: 1,
        body: 'no relationship',
      }),
    },
    customer.jwt,
  )
  record('a draft enquiry does not entitle a review', offDraft.status >= 400, `HTTP ${offDraft.status}`)

  const offBooked = await rest(
    'reviews',
    ANON,
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        enquiry_id: booked.id,
        customer_id: customer.id,
        vendor_id: vendor.id,
        overall_rating: 5,
        title: 'Wonderful',
        body: 'They were excellent from start to finish.',
      }),
    },
    customer.jwt,
  )
  record('a booked enquiry does entitle one', offBooked.status === 201, `HTTP ${offBooked.status}`)

  const review = Array.isArray(offBooked.body) ? offBooked.body[0] : null
  if (!review) throw new Error('Could not create the probe review; later assertions are meaningless')
  cleanup.push(() => rest(`reviews?id=eq.${review.id}`, SVC, { method: 'DELETE' }))

  record('it arrives pending, never approved', review.status === 'pending', `status=${review.status}`)

  const duplicate = await rest(
    'reviews',
    ANON,
    {
      method: 'POST',
      body: JSON.stringify({
        enquiry_id: booked.id,
        customer_id: customer.id,
        vendor_id: vendor.id,
        overall_rating: 4,
        body: 'second attempt at the same enquiry',
      }),
    },
    customer.jwt,
  )
  record('one review per enquiry', duplicate.status >= 400, `HTTP ${duplicate.status}`)

  console.log('\nmoderation integrity:')

  const selfApprove = await rest(
    `reviews?id=eq.${review.id}`,
    ANON,
    { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) },
    customer.jwt,
  )
  record('author cannot approve their own review', selfApprove.status >= 400, `HTTP ${selfApprove.status}`)

  const reassign = await rest(
    `reviews?id=eq.${review.id}`,
    ANON,
    {
      method: 'PATCH',
      body: JSON.stringify({ vendor_id: '00000000-0000-0000-0000-000000000000' }),
    },
    customer.jwt,
  )
  record('author cannot move it to another vendor', reassign.status >= 400, `HTTP ${reassign.status}`)

  const setReason = await rest(
    `reviews?id=eq.${review.id}`,
    ANON,
    { method: 'PATCH', body: JSON.stringify({ moderation_reason: 'looks fine to me' }) },
    customer.jwt,
  )
  record('author cannot write the moderation reason', setReason.status >= 400, `HTTP ${setReason.status}`)

  console.log('\nrating aggregates:')

  const approvedByAdmin = await rest(
    `reviews?id=eq.${review.id}`,
    ANON,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved', moderation_reason: null }),
    },
    admin.jwt,
  )
  record('a real moderator can approve', approvedByAdmin.status === 204, `HTTP ${approvedByAdmin.status}`)
  const afterApproval = (
    await rest(`vendors?select=rating_average,rating_count&id=eq.${vendor.id}`, SVC)
  ).body[0]
  record(
    'approval moves the aggregate',
    Number(afterApproval.rating_count) > 0,
    `count=${afterApproval.rating_count}`,
  )

  console.log('\nedit window and revisions:')

  const edit = await rest(
    `reviews?id=eq.${review.id}`,
    ANON,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ body: 'Rewritten after it was published.' }),
    },
    customer.jwt,
  )
  record('author may edit inside the window', edit.status === 200, `HTTP ${edit.status}`)
  record(
    'editing returns it to moderation',
    Array.isArray(edit.body) && edit.body[0]?.status === 'pending',
    `status=${edit.body?.[0]?.status}`,
  )

  const revisions = (
    await rest(`review_revisions?select=body&review_id=eq.${review.id}`, SVC)
  ).body
  record(
    'the previous text is kept',
    Array.isArray(revisions) && revisions.length === 1,
    `${revisions?.length} revision(s)`,
  )

  const afterEdit = (
    await rest(`vendors?select=rating_count&id=eq.${vendor.id}`, SVC)
  ).body[0]
  record(
    'un-approving removes it from the aggregate again',
    Number(afterEdit.rating_count) === 0,
    `count=${afterEdit.rating_count}`,
  )

  console.log('\nvendor responses:')

  await rest(
    `reviews?id=eq.${review.id}`,
    ANON,
    { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) },
    admin.jwt,
  )

  const otherVendor = (
    await rest(`vendors?select=id&status=eq.active&id=neq.${vendor.id}&limit=1`, SVC)
  ).body[0]
  const crossPost = await rest(
    'review_responses',
    ANON,
    {
      method: 'POST',
      body: JSON.stringify({
        review_id: review.id,
        vendor_id: otherVendor.id,
        body: 'not my review',
      }),
    },
    vendorUser.jwt,
  )
  record('a different vendor cannot answer it', crossPost.status >= 400, `HTTP ${crossPost.status}`)

  const ownPost = await rest(
    'review_responses',
    ANON,
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        review_id: review.id,
        vendor_id: vendor.id,
        body: 'Thank you so much for the kind words.',
      }),
    },
    vendorUser.jwt,
  )
  record('the reviewed vendor can answer it', ownPost.status === 201, `HTTP ${ownPost.status}`)
  const response = Array.isArray(ownPost.body) ? ownPost.body[0] : null
  record(
    'the reply starts unpublished',
    response?.status === 'pending',
    `status=${response?.status}`,
  )

  const anonSeesReply = await rest(
    `review_responses?select=id&review_id=eq.${review.id}`,
    ANON,
  )
  record(
    'the public cannot see an unapproved reply',
    Array.isArray(anonSeesReply.body) && anonSeesReply.body.length === 0,
    `${anonSeesReply.body?.length ?? '?'} visible`,
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
