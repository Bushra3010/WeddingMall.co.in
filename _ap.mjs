import { readFileSync } from 'node:fs'
import pg from 'pg'
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const c = new pg.Client({host:`db.${REF}.supabase.co`,port:5432,user:'postgres',password:process.env.PGPASSWORD,database:'postgres',ssl:{rejectUnauthorized:false},statement_timeout:120000})
await c.connect()
const f=process.argv[2]
try { await c.query('begin'); await c.query(readFileSync(f,'utf8')); await c.query('commit'); console.log('ok ',f) }
catch(e){ await c.query('rollback').catch(()=>{}); console.log('FAIL',e.message); if(e.detail)console.log('detail:',e.detail); process.exitCode=1 }
await c.end()
