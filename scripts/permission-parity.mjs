/**
 * Permission-catalogue drift check (CLAUDE.md invariant 3, ADR-004).
 *
 * "The permission catalogue is mirrored in SQL — change one, change the
 * other." Nothing enforced that, and it has already cost something real:
 * migration `0019` guarded `sla_policy` with `has_admin_permission('settings.manage')`,
 * a permission that exists in neither place. `has_admin_permission` returns
 * false for a code it has never heard of, so the policy was deny-all and the
 * SLA threshold could not be changed by anyone — including a super-admin —
 * until `0028`. It failed closed, so it was never a hole; it was a feature
 * that silently did not work, and it returned `204` with zero rows matched,
 * which is the shape of success (ADR-036).
 *
 * This applies ADR-020's technique — compare the REAL TypeScript source
 * against the database, never a hand-copied list — to three things:
 *
 *   1. the permission codes themselves, both directions;
 *   2. the role → permission matrix, both directions;
 *   3. every permission named by a *deployed* policy or function, which is
 *      where the bug actually was.
 *
 * (3) matters most: a typo there type-checks, applies cleanly, and manifests
 * only as a policy nobody can satisfy. It reads `pg_policies` and `pg_proc`
 * rather than the migration files — see the note at that check for why.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVC = process.env.SUPABASE_SECRET_KEY

if (!URL_BASE || !SVC) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}

// Node 20 cannot `require()` TypeScript, so the real module is compiled and
// imported. A copy of the catalogue here would pass while the app drifted,
// which is the exact failure this script exists to prevent.
const outDir = mkdtempSync(join(tmpdir(), 'wm-perm-'))
const outFile = join(outDir, 'catalogue.mjs')
execFileSync('node_modules/esbuild/bin/esbuild', [
  'src/lib/permissions/catalogue.ts',
  '--format=esm',
  `--outfile=${outFile}`,
])
const { PERMISSIONS, ADMIN_ROLES, ADMIN_ROLE_PERMISSIONS, VENDOR_CAPABILITIES } = await import(
  outFile
)

const results = []
const record = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function db(path) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
  })
  return res.json()
}

const sqlPermissions = new Set((await db('admin_permissions?select=code')).map((r) => r.code))
const sqlRoles = new Set((await db('admin_roles?select=code')).map((r) => r.code))
const tsPermissions = new Set(PERMISSIONS)
const tsRoles = new Set(ADMIN_ROLES)

console.log('\npermission codes:')

const missingInSql = [...tsPermissions].filter((code) => !sqlPermissions.has(code))
record('every TypeScript permission exists in SQL', missingInSql.length === 0, missingInSql.join(', '))

const missingInTs = [...sqlPermissions].filter((code) => !tsPermissions.has(code))
record('every SQL permission exists in TypeScript', missingInTs.length === 0, missingInTs.join(', '))

console.log('\nroles:')

const rolesMissingInSql = [...tsRoles].filter((code) => !sqlRoles.has(code))
record('every TypeScript role exists in SQL', rolesMissingInSql.length === 0, rolesMissingInSql.join(', '))

const rolesMissingInTs = [...sqlRoles].filter((code) => !tsRoles.has(code))
record('every SQL role exists in TypeScript', rolesMissingInTs.length === 0, rolesMissingInTs.join(', '))

console.log('\nrole → permission matrix:')

const grants = await db('admin_role_permissions?select=admin_roles(code),admin_permissions(code)')
const sqlMatrix = new Map()
for (const row of grants) {
  const role = row.admin_roles?.code
  const permission = row.admin_permissions?.code
  if (!role || !permission) continue
  if (!sqlMatrix.has(role)) sqlMatrix.set(role, new Set())
  sqlMatrix.get(role).add(permission)
}

const mismatches = []
for (const role of tsRoles) {
  const expected = new Set(ADMIN_ROLE_PERMISSIONS[role] ?? [])
  const actual = sqlMatrix.get(role) ?? new Set()
  const onlyTs = [...expected].filter((p) => !actual.has(p))
  const onlySql = [...actual].filter((p) => !expected.has(p))
  if (onlyTs.length || onlySql.length) {
    mismatches.push(
      `${role}: ${onlyTs.length ? `TS-only [${onlyTs}]` : ''}${onlySql.length ? ` SQL-only [${onlySql}]` : ''}`,
    )
  }
}
record('the matrix agrees in both directions', mismatches.length === 0, mismatches.join(' | '))

console.log('\npermissions referenced by live policies and functions:')

/*
 * The check that would have caught `settings.manage`.
 *
 * Reads the policy expressions and function bodies **from the database**, not
 * from the migration files. Scanning migrations was the first attempt and was
 * wrong twice over: it matches text inside SQL comments (so `0028`, which
 * fixes the bug, reads as if it still has it), and it reports history rather
 * than current state — a superseded migration must never be edited, so its
 * mistakes would be permanently red.
 *
 * `pg_policies` and `pg_proc` describe what is actually deployed, which is the
 * only thing worth asserting on.
 */
const pgUrl = process.env.PGPASSWORD
if (!pgUrl) {
  console.log('         SKIP — needs PGPASSWORD to read pg_policies.')
  console.log('         Run: PGPASSWORD=... npm run check:permissions')
} else {
  const { default: pg } = await import('pg')
  const client = new pg.Client({
    host: `db.${new URL(URL_BASE).hostname.split('.')[0]}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: pgUrl,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const { rows } = await client.query(`
    select 'policy' as kind, schemaname || '.' || tablename || ' / ' || policyname as name,
           coalesce(qual, '') || ' ' || coalesce(with_check, '') as body
    from pg_policies where schemaname = 'public'
    union all
    select 'function', n.nspname || '.' || p.proname, pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  `)
  await client.end()

  const referenced = new Map()
  for (const row of rows) {
    /*
     * The `::text` is not optional cosmetics. Postgres normalises a policy
     * expression when it stores it, so `has_admin_permission('x')` comes back
     * from `pg_policies` as `has_admin_permission('x'::text)`. A pattern
     * without the cast silently matches no policy at all — which is how the
     * first version of this check passed a deliberately broken policy.
     */
    for (const match of String(row.body).matchAll(
      /has_admin_permission\(\s*'([^']+)'(?:\s*::\s*text)?\s*\)/g,
    )) {
      if (!referenced.has(match[1])) referenced.set(match[1], new Set())
      referenced.get(match[1]).add(`${row.kind} ${row.name}`)
    }
  }

  const unknown = [...referenced.entries()].filter(([code]) => !sqlPermissions.has(code))
  record(
    'every permission named by a live policy or function exists',
    unknown.length === 0,
    unknown.map(([code, where]) => `${code} (${[...where].join(', ')})`).join('; '),
  )
  console.log(`         ${referenced.size} distinct permission(s) referenced in deployed objects`)
}

console.log('\nvendor capabilities:')

const capabilityRows = await db('vendor_role_capabilities?select=capability')
const sqlCapabilities = new Set((capabilityRows ?? []).map?.((r) => r.capability) ?? [])

if (sqlCapabilities.size === 0) {
  /*
   * `vendor_can()` encodes the matrix in a function body rather than a table,
   * so there is nothing to diff against. Reported rather than skipped
   * silently: an unchecked half of the invariant should be visible, not
   * absent (ADR-004 remains open for this).
   */
  console.log('         SKIP — vendor_can() holds the matrix in a function body, not a table.')
  console.log('         Not comparable without parsing PL/pgSQL; ADR-004 stays open for this half.')
} else {
  const capsMissing = [...VENDOR_CAPABILITIES].filter((c) => !sqlCapabilities.has(c))
  record('every TypeScript vendor capability exists in SQL', capsMissing.length === 0, capsMissing.join(', '))
}

const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
