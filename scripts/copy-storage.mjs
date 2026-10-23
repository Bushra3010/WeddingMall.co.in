/**
 * Copy every Storage object from one Supabase project to another.
 *
 * Buckets are created on the target when missing (same visibility, size limit
 * and MIME allow-list). Objects already present on the target with the same
 * size are skipped, so the script can be re-run after a failure.
 *
 * Usage:
 *   SRC_SUPABASE_URL=https://<old>.supabase.co SRC_SUPABASE_SERVICE_KEY=... \
 *   DST_SUPABASE_URL=https://<new>.supabase.co DST_SUPABASE_SERVICE_KEY=... \
 *   node scripts/copy-storage.mjs [--dry-run]
 *
 * Service keys are required because `vendor-documents` and
 * `message-attachments` are private. Nothing here runs in the app.
 */
import { createClient } from '@supabase/supabase-js'

const need = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const dryRun = process.argv.includes('--dry-run')
const CONCURRENCY = 4

const client = (url, key) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const src = client(need('SRC_SUPABASE_URL'), need('SRC_SUPABASE_SERVICE_KEY'))
const dst = client(need('DST_SUPABASE_URL'), need('DST_SUPABASE_SERVICE_KEY'))

/** Walk a bucket and return every file (folders have no `id`). */
async function listAll(storage, bucket, prefix = '') {
  const files = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id)
        files.push({ path, size: entry.metadata?.size ?? null, mime: entry.metadata?.mimetype })
      else files.push(...(await listAll(storage, bucket, path)))
    }
    if (data.length < 1000) break
  }
  return files
}

async function ensureBucket(bucket) {
  const { data: existing } = await dst.storage.getBucket(bucket.id)
  if (existing) return
  if (dryRun) return console.log(`  would create bucket ${bucket.id}`)
  const { error } = await dst.storage.createBucket(bucket.id, {
    public: bucket.public,
    fileSizeLimit: bucket.file_size_limit ?? undefined,
    allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
  })
  if (error) throw new Error(`create bucket ${bucket.id}: ${error.message}`)
  console.log(`  created bucket ${bucket.id}`)
}

async function copyOne(bucket, file) {
  const { data: blob, error: downloadError } = await src.storage.from(bucket).download(file.path)
  if (downloadError) throw new Error(`download ${bucket}/${file.path}: ${downloadError.message}`)
  const { error: uploadError } = await dst.storage.from(bucket).upload(file.path, blob, {
    contentType: file.mime ?? blob.type ?? undefined,
    cacheControl: '31536000',
    upsert: true,
  })
  if (uploadError) throw new Error(`upload ${bucket}/${file.path}: ${uploadError.message}`)
}

async function runPool(items, worker) {
  let next = 0
  const failures = []
  const lanes = Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      const item = items[next++]
      try {
        await worker(item)
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error))
      }
    }
  })
  await Promise.all(lanes)
  return failures
}

const { data: buckets, error: bucketsError } = await src.storage.listBuckets()
if (bucketsError) throw new Error(`listBuckets: ${bucketsError.message}`)

let copied = 0
let skipped = 0
const failures = []

for (const bucket of buckets) {
  console.log(`▶ ${bucket.id} (${bucket.public ? 'public' : 'private'})`)
  await ensureBucket(bucket)

  const [source, target] = await Promise.all([
    listAll(src.storage, bucket.id),
    dryRun ? [] : listAll(dst.storage, bucket.id).catch(() => []),
  ])
  const present = new Map(target.map((f) => [f.path, f.size]))
  const todo = source.filter((f) => present.get(f.path) !== f.size)
  skipped += source.length - todo.length
  console.log(`  ${source.length} objects, ${todo.length} to copy`)

  if (dryRun) continue
  failures.push(...(await runPool(todo, (file) => copyOne(bucket.id, file))))
  copied += todo.length
}

copied -= failures.length
console.log(`\n✔ copied ${copied}, skipped ${skipped} already present, failed ${failures.length}`)
for (const failure of failures) console.error(`  ✖ ${failure}`)
process.exitCode = failures.length ? 1 : 0
