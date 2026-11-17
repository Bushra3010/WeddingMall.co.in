import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache'

/**
 * Cloudflare Workers adapter config.
 *
 * Incremental cache in Workers KV keeps ISR pages (`revalidate = 300/600/900/3600`)
 * and the shared `unstable_cache` entries (taxonomy, search) across requests
 * and isolates. `revalidateTag` from admin actions is not wired to a tag cache
 * yet; tagged entries still expire on their TTL (10 min taxonomy, 5 min search).
 */
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
})
