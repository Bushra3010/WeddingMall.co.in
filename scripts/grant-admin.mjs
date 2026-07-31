/**
 * Grants an admin role to an existing account.
 *
 * There is no public admin sign-up (PRD 6.4) and `admin_memberships` has no
 * user-facing insert policy, so elevation cannot happen through the app at all
 * — by design (Epic E: "super-admin role cannot be created through public
 * input"). This script is the deliberate out-of-band path, and it writes an
 * audit entry so the grant is not invisible.
 *
 * Usage:
 *   node --env-file=.env.local scripts/grant-admin.mjs you@example.com [role]
 *
 * Roles: super_admin (default), operations_admin, vendor_verifier,
 *        content_admin, support_agent, finance_admin, analyst
 */
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVC = process.env.SUPABASE_SECRET_KEY

const [email, roleCode = 'super_admin'] = process.argv.slice(2)

if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/grant-admin.mjs <email> [role]')
  process.exit(1)
}

async function rest(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (res.status >= 400) throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`)
  return body
}

// The Auth admin API has no email filter, so page through and match locally.
let user = null
for (let page = 1; page <= 20 && !user; page++) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users?page=${page}&per_page=200`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
  })
  const data = await res.json()
  const batch = data?.users ?? []
  if (batch.length === 0) break
  user = batch.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null
}

if (!user) {
  console.error(`No account found for ${email}. Sign up through the app first, then re-run this.`)
  process.exit(1)
}

const [role] = await rest(`admin_roles?select=id,code&code=eq.${roleCode}`)
if (!role) {
  console.error(`Unknown role "${roleCode}".`)
  process.exit(1)
}

const existing = await rest(
  `admin_memberships?select=id,status&user_id=eq.${user.id}&role_id=eq.${role.id}`,
)

if (existing.length > 0) {
  await rest(`admin_memberships?id=eq.${existing[0].id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'active' }),
  })
  console.log(`Reactivated ${roleCode} for ${email}`)
} else {
  await rest('admin_memberships', {
    method: 'POST',
    body: JSON.stringify({ user_id: user.id, role_id: role.id, status: 'active' }),
  })
  console.log(`Granted ${roleCode} to ${email}`)
}

await rest('audit_logs', {
  method: 'POST',
  body: JSON.stringify({
    actor_user_id: user.id,
    actor_type: 'system',
    action: 'admin.role_granted',
    entity_type: 'user',
    entity_id: user.id,
    after_json: { role: roleCode },
    reason: 'granted out-of-band via scripts/grant-admin.mjs',
  }),
})

console.log('Sign out and back in for the new permissions to take effect.')
