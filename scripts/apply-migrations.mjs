/**
 * Applies supabase/migrations/*.sql (and optionally seed.sql) to the remote
 * project, one statement-batch per file, reporting the first failure precisely.
 *
 * Usage: PGPASSWORD='...' node apply.mjs [--seed] [--host <pooler-host>]
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const REF = 'ijuhvltvenfqqpsefoky'
const ROOT = '/Users/bushrakhan/Downloads/Wedding Mall/supabase'
const password = process.env.PGPASSWORD
if (!password) throw new Error('PGPASSWORD not set')

const args = process.argv.slice(2)
const withSeed = args.includes('--seed') || args.includes('--seed-only')
const seedOnly = args.includes('--seed-only')
const hostArg = args.includes('--host') ? args[args.indexOf('--host') + 1] : null

const REGIONS = [
  'ap-south-1',
  'ap-southeast-1',
  'us-east-1',
  'us-west-1',
  'eu-west-1',
  'eu-central-1',
  'ap-northeast-1',
  'ca-central-1',
  'sa-east-1',
  'ap-southeast-2',
  'eu-west-2',
]

const candidates = hostArg
  ? [{ host: hostArg, user: `postgres.${REF}`, port: 5432 }]
  : [
      { host: `db.${REF}.supabase.co`, user: 'postgres', port: 5432 },
      ...REGIONS.map((r) => ({
        host: `aws-0-${r}.pooler.supabase.com`,
        user: `postgres.${REF}`,
        port: 5432,
      })),
    ]

async function connect() {
  for (const c of candidates) {
    const client = new pg.Client({
      host: c.host,
      port: c.port,
      user: c.user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
      statement_timeout: 120000,
    })
    try {
      await client.connect()
      console.log(`connected via ${c.host} as ${c.user}`)
      return client
    } catch (error) {
      const msg = String(error.message || error)
      // A wrong password proves the host is right — stop and report clearly.
      if (/password authentication failed|SASL/i.test(msg)) {
        throw new Error(`Host ${c.host} reachable but password rejected: ${msg}`)
      }
      await client.end().catch(() => {})
    }
  }
  throw new Error('Could not reach any Supabase Postgres host')
}

const client = await connect()

const files = seedOnly
  ? []
  : readdirSync(join(ROOT, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()
if (withSeed) files.push('__seed__')

let failed = false
for (const file of files) {
  const path = file === '__seed__' ? join(ROOT, 'seed.sql') : join(ROOT, 'migrations', file)
  const label = file === '__seed__' ? 'seed.sql' : file
  const sql = readFileSync(path, 'utf8')

  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    console.log(`  ok   ${label}`)
  } catch (error) {
    await client.query('rollback').catch(() => {})
    console.log(`  FAIL ${label}`)
    console.log(`       ${error.message}`)
    if (error.position) {
      const pos = Number(error.position)
      const before = sql.slice(0, pos)
      const line = before.split('\n').length
      const context = sql.split('\n').slice(Math.max(0, line - 4), line + 2)
      console.log(`       at line ${line}:`)
      for (const l of context) console.log(`         | ${l}`)
    }
    if (error.detail) console.log(`       detail: ${error.detail}`)
    if (error.hint) console.log(`       hint: ${error.hint}`)
    failed = true
    break
  }
}

await client.end()
process.exit(failed ? 1 : 0)
