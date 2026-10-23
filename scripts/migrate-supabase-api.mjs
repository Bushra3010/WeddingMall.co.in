/**
 * Move schema and data between two Supabase projects through the Management
 * API's SQL endpoint, so no database password is needed — only two personal
 * access tokens. Used when `migrate-supabase-data.sh` (pg_dump) is not an
 * option.
 *
 * Usage:
 *   SRC_REF=<old ref> SRC_TOKEN=sbp_... DST_REF=<new ref> DST_TOKEN=sbp_... \
 *   node scripts/migrate-supabase-api.mjs schema      # apply supabase/migrations to DST
 *   node scripts/migrate-supabase-api.mjs data        # copy public + auth rows SRC → DST
 *   node scripts/migrate-supabase-api.mjs verify      # row counts on both sides
 *
 * `data` loads with `session_replication_role = replica` so triggers stay
 * silent, truncates DST's public tables first, and chunks rows as JSON.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const need = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const command = process.argv[2]
const ROOT = fileURLToPath(new URL('../supabase', import.meta.url))
const CHUNK = 300
const AUTH_TABLES = ['auth.users', 'auth.identities', 'auth.mfa_factors']

async function sql(ref, token, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${ref}: ${body?.message ?? res.statusText}`)
  return body
}

const src = (q) => sql(need('SRC_REF'), need('SRC_TOKEN'), q)
const dst = (q) => sql(need('DST_REF'), need('DST_TOKEN'), q)

const ident = (table) =>
  table
    .split('.')
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join('.')

/** Column names of a table, minus generated ones (they refuse inserts). */
async function columns(run, table) {
  const [schema, name] = table.split('.')
  const rows = await run(`select column_name from information_schema.columns
    where table_schema = '${schema}' and table_name = '${name}' and is_generated = 'NEVER'
    order by ordinal_position`)
  return rows.map((r) => r.column_name)
}

/** Public tables ordered so parents come before children (FK order). */
async function publicTablesInOrder(run) {
  const rows = await run(`
    with recursive deps as (
      select c.oid, c.relname, 0 as depth
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and not exists (select 1 from pg_constraint f
                          where f.conrelid = c.oid and f.contype = 'f' and f.confrelid <> c.oid)
      union
      select c.oid, c.relname, d.depth + 1
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        join pg_constraint f on f.conrelid = c.oid and f.contype = 'f' and f.confrelid <> c.oid
        join deps d on d.oid = f.confrelid
       where n.nspname = 'public' and c.relkind = 'r' and d.depth < 20
    )
    select relname from deps group by relname order by max(depth), relname`)
  const ordered = rows.map((r) => `public.${r.relname}`)
  // Tables with only self-references or cycles fall out of the walk; append them.
  const all = await run(`select tablename from pg_tables where schemaname = 'public' order by 1`)
  for (const { tablename } of all) {
    if (!ordered.includes(`public.${tablename}`)) ordered.push(`public.${tablename}`)
  }
  return ordered
}

async function applySchema() {
  const files = readdirSync(join(ROOT, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
  const only = process.argv[3]
  for (const file of files) {
    if (only && !file.startsWith(only)) continue
    const body = readFileSync(join(ROOT, 'migrations', file), 'utf8')
    process.stdout.write(`▶ ${file} … `)
    await dst(body)
    console.log('ok')
  }
}

async function copyTable(table) {
  const cols = await columns(src, table)
  const colList = cols.map((c) => `"${c}"`).join(', ')
  const [{ n }] = await src(`select count(*)::int as n from ${ident(table)}`)
  if (n === 0) return console.log(`  ${table}: 0 rows`)

  // Stable order so chunks never overlap.
  const orderBy = cols.includes('id') ? '"id"' : colList
  let copied = 0
  for (let offset = 0; offset < n; offset += CHUNK) {
    const [{ rows }] = await src(
      `select coalesce(json_agg(t), '[]'::json) as rows from
         (select ${colList} from ${ident(table)} order by ${orderBy} limit ${CHUNK} offset ${offset}) t`,
    )
    const json = JSON.stringify(rows)
    const tag = `$j${offset}$`
    await dst(`set session_replication_role = replica;
      insert into ${ident(table)} (${colList})
      select ${colList} from json_populate_recordset(null::${ident(table)}, ${tag}${json}${tag})`)
    copied += rows.length
  }
  console.log(`  ${table}: ${copied} rows`)
}

async function copyData() {
  const [{ tables }] = await dst(
    `select count(*)::int as tables from pg_tables where schemaname = 'public'`,
  )
  if (tables < 10) throw new Error(`DST has ${tables} public tables — run "schema" first`)

  const publicTables = await publicTablesInOrder(src)
  console.log(`▶ Truncating ${publicTables.length} public tables on DST`)
  await dst(`set session_replication_role = replica;
    truncate table ${publicTables.map(ident).join(', ')} cascade;
    truncate table auth.identities, auth.mfa_factors, auth.sessions, auth.refresh_tokens cascade;
    delete from auth.users`)

  console.log('▶ auth')
  for (const table of AUTH_TABLES) await copyTable(table)
  console.log('▶ public')
  for (const table of publicTables) await copyTable(table)

  console.log('▶ Sequences and search text')
  const seqs = await dst(`select s.relname as seq, t.relname as tbl, a.attname as col
    from pg_class s join pg_depend d on d.objid = s.oid and d.deptype = 'a'
    join pg_class t on t.oid = d.refobjid join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
    join pg_namespace n on n.oid = t.relnamespace
    where s.relkind = 'S' and n.nspname = 'public'`)
  for (const { seq, tbl, col } of seqs) {
    await dst(
      `select setval('public."${seq}"', coalesce((select max("${col}") from public."${tbl}"), 0) + 1, false)`,
    )
  }
  await dst(`select count(public.refresh_vendor_search_text(id)) from public.vendors`)
}

async function verify() {
  const q = `select 'auth.users' as t, count(*)::int as n from auth.users
    union all select 'vendors', count(*) from public.vendors
    union all select 'enquiries', count(*) from public.enquiries
    union all select 'messages', count(*) from public.messages
    union all select 'categories', count(*) from public.categories
    union all select 'storage.objects', count(*) from storage.objects`
  const [a, b] = await Promise.all([src(q), dst(q)])
  for (let i = 0; i < a.length; i++) {
    const flag = a[i].n === b[i]?.n ? '✔' : '✖'
    console.log(`${flag} ${a[i].t}: src ${a[i].n} → dst ${b[i]?.n}`)
  }
}

const commands = { schema: applySchema, data: copyData, verify }
if (!commands[command]) {
  console.error('usage: migrate-supabase-api.mjs schema|data|verify')
  process.exit(1)
}
await commands[command]()
