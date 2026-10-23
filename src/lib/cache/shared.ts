import { unstable_cache } from 'next/cache'

/**
 * Cross-request cache for public, cookie-free reads.
 *
 * React's `cache()` only dedupes within one render. Every render of a
 * per-request page (`/vendors` with search params, category pages) was
 * therefore re-fetching categories, cities and attribute definitions from
 * Supabase — about 60% of all REST calls on 2026-10-23, and a second or more
 * of function time per page that hosting bills by the GB-hour.
 *
 * Callers must use the cookie-free public client: the cache is shared across
 * visitors by design, so nothing user-specific may flow through it.
 *
 * Outside a Next server (vitest, scripts) there is no incremental cache and
 * `unstable_cache` throws, so the raw function is returned instead.
 */
export const CACHE_TAGS = {
  taxonomy: 'taxonomy',
  vendors: 'vendors',
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sharedCache<T extends (...args: any[]) => Promise<unknown>>(
  fn: T,
  key: string,
  options: { revalidate: number; tags: string[] },
): T {
  if (process.env.NODE_ENV === 'test') return fn
  return unstable_cache(fn, [key], options) as unknown as T
}
