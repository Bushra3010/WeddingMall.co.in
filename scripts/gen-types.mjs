/**
 * Generates src/types/database.ts by introspecting a live Postgres.
 *
 * Why this exists instead of `supabase gen types`: that command runs its
 * introspection inside a container, so it needs Docker even with --db-url.
 * This talks to the database directly over the same pooler connection the app
 * uses, so it works anywhere Node runs.
 *
 * Emits Row/Insert/Update per table, Relationships (which is what lets
 * supabase-js type embedded `select('a, other(b)')` queries), views, enums,
 * and function signatures.
 *
 * Usage: PGPASSWORD=... node scripts/gen-types.mjs [--host <h>] [--user <u>]
 */
import { writeFileSync } from 'node:fs'
import pg from 'pg'

const args = process.argv.slice(2)
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)

const client = new pg.Client({
  host: opt('--host', 'aws-0-ap-northeast-1.pooler.supabase.com'),
  port: Number(opt('--port', '5432')),
  user: opt('--user', 'postgres.ijuhvltvenfqqpsefoky'),
  password: process.env.PGPASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const SCALARS = {
  uuid: 'string',
  text: 'string',
  varchar: 'string',
  bpchar: 'string',
  citext: 'string',
  name: 'string',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  bool: 'boolean',
  json: 'Json',
  jsonb: 'Json',
  timestamptz: 'string',
  timestamp: 'string',
  date: 'string',
  time: 'string',
  timetz: 'string',
  interval: 'string',
  bytea: 'string',
  inet: 'string',
  tsvector: 'unknown',
}

const { rows: enums } = await client.query(`
  select t.typname as name, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  where t.typnamespace = 'public'::regnamespace
  group by t.typname
  order by t.typname
`)
const enumNames = new Set(enums.map((e) => e.name))

function tsType(udtName, isArray) {
  const base = enumNames.has(udtName)
    ? `Database["public"]["Enums"]["${udtName}"]`
    : (SCALARS[udtName] ?? 'unknown')
  return isArray ? `${base}[]` : base
}

const { rows: columns } = await client.query(`
  select c.table_name, c.column_name, c.is_nullable, c.column_default,
         c.data_type, c.udt_name, c.is_identity, c.is_generated,
         t.table_type
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public'
  order by c.table_name, c.ordinal_position
`)

const { rows: fks } = await client.query(`
  select
    con.conname as constraint_name,
    src.relname as table_name,
    array_agg(sa.attname::text order by u.ord) as columns,
    tgt.relname as foreign_table,
    array_agg(ta.attname::text order by u.ord) as foreign_columns,
    (select count(*) from pg_index i
      where i.indrelid = con.conrelid
        and i.indisunique
        and i.indnkeyatts = array_length(con.conkey, 1)
        and i.indkey::int2[] @> con.conkey) > 0 as is_one_to_one
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class tgt on tgt.oid = con.confrelid
  join lateral unnest(con.conkey) with ordinality as u(attnum, ord) on true
  join pg_attribute sa on sa.attrelid = con.conrelid and sa.attnum = u.attnum
  join lateral unnest(con.confkey) with ordinality as fu(attnum, ord)
    on fu.ord = u.ord
  join pg_attribute ta on ta.attrelid = con.confrelid and ta.attnum = fu.attnum
  where con.contype = 'f' and src.relnamespace = 'public'::regnamespace
  group by con.conname, src.relname, tgt.relname, con.conrelid, con.conkey
  order by src.relname, con.conname
`)

const { rows: functions } = await client.query(`
  select p.proname as name,
         pg_get_function_arguments(p.oid) as args,
         pg_get_function_result(p.oid) as result
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.prokind = 'f'
    and has_function_privilege('anon', p.oid, 'execute')
  order by p.proname
`)

await client.end()

// --- assemble -------------------------------------------------------------

const byRelation = new Map()
for (const col of columns) {
  if (!byRelation.has(col.table_name)) {
    byRelation.set(col.table_name, { type: col.table_type, cols: [] })
  }
  byRelation.get(col.table_name).cols.push(col)
}

const fkByTable = new Map()
for (const fk of fks) {
  if (!fkByTable.has(fk.table_name)) fkByTable.set(fk.table_name, [])
  fkByTable.get(fk.table_name).push(fk)
}

function renderRelationships(name) {
  const list = fkByTable.get(name) ?? []
  if (!list.length) return '      Relationships: []'
  const entries = list
    .map(
      (fk) => `        {
          foreignKeyName: "${fk.constraint_name}"
          columns: [${fk.columns.map((c) => `"${c}"`).join(', ')}]
          isOneToOne: ${fk.is_one_to_one}
          referencedRelation: "${fk.foreign_table}"
          referencedColumns: [${fk.foreign_columns.map((c) => `"${c}"`).join(', ')}]
        }`,
    )
    .join(',\n')
  return `      Relationships: [\n${entries}\n      ]`
}

function renderRelation(name, meta) {
  const isView = meta.type === 'VIEW'
  const row = meta.cols
    .map((c) => {
      const t = tsType(c.udt_name, c.data_type === 'ARRAY')
      const nullable = c.is_nullable === 'YES'
      // A view column's nullability is not reliably reported, so widen it.
      return `          ${c.column_name}: ${t}${nullable || isView ? ' | null' : ''}`
    })
    .join('\n')

  if (isView) {
    return `      ${JSON.stringify(name)}: {
        Row: {
${row}
        }
${renderRelationships(name)}
      }`
  }

  const insert = meta.cols
    .map((c) => {
      const t = tsType(c.udt_name, c.data_type === 'ARRAY')
      const nullable = c.is_nullable === 'YES'
      const optional = nullable || c.column_default !== null || c.is_identity === 'YES'
      return `          ${c.column_name}${optional ? '?' : ''}: ${t}${nullable ? ' | null' : ''}`
    })
    .join('\n')

  const update = meta.cols
    .map((c) => {
      const t = tsType(c.udt_name, c.data_type === 'ARRAY')
      const nullable = c.is_nullable === 'YES'
      return `          ${c.column_name}?: ${t}${nullable ? ' | null' : ''}`
    })
    .join('\n')

  return `      ${JSON.stringify(name)}: {
        Row: {
${row}
        }
        Insert: {
${insert}
        }
        Update: {
${update}
        }
${renderRelationships(name)}
      }`
}

const tables = [...byRelation.entries()].filter(([, m]) => m.type === 'BASE TABLE')
const views = [...byRelation.entries()].filter(([, m]) => m.type === 'VIEW')

const enumBlock = enums
  .map((e) => `      ${e.name}: ${e.labels.map((l) => `"${l}"`).join(' | ')}`)
  .join('\n')

const functionBlock = functions
  .map(
    (f) => `      ${f.name}: {
        Args: ${f.args ? '{ [key: string]: unknown }' : 'Record<string, never>'}
        Returns: unknown
      }`,
  )
  .join('\n')

const output = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with:
 *   PGPASSWORD=... npm run db:types
 *
 * Source of truth is supabase/migrations/. If this file disagrees with the
 * database, regenerate rather than patching.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
${tables.map(([n, m]) => renderRelation(n, m)).join('\n')}
    }
    Views: {
${views.map(([n, m]) => renderRelation(n, m)).join('\n')}
    }
    Functions: {
${functionBlock}
    }
    Enums: {
${enumBlock}
    }
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
`

writeFileSync('src/types/database.ts', output)
console.log(
  `generated src/types/database.ts — ${tables.length} tables, ${views.length} views, ${enums.length} enums, ${fks.length} foreign keys`,
)
