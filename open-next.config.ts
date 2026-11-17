import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'

/**
 * Cloudflare Workers adapter config.
 *
 * Incremental cache in R2 keeps ISR pages (`revalidate = 300/600/900/3600`)
 * and the shared `unstable_cache` entries (taxonomy, search) across requests
 * and isolates. `revalidateTag` from admin actions is not wired to a tag cache
 * yet; tagged entries still expire on their TTL (10 min taxonomy, 5 min search).
 */
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
})
