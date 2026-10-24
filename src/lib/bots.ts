/**
 * Crawlers that are refused outright on the per-request routes.
 *
 * These are SEO-index and AI-training scrapers, not search engines: none of
 * them sends a visitor, and together they were re-rendering `/vendors` search
 * combinations around 66 times a minute (95,800 `search_vendors` calls on
 * 2026-10-17), which is what exhausted two Vercel Hobby accounts and burns
 * Netlify compute credits. Google, Bing and the social preview bots are not
 * listed; `robots.txt` already keeps the well-behaved ones off filtered URLs.
 *
 * Matching is a plain case-insensitive substring test on the User-Agent, so
 * the list stays readable and cheap to run at the edge.
 */
export const BLOCKED_BOT_TOKENS = [
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'PetalBot',
  'Bytespider',
  'GPTBot',
  'CCBot',
  'ClaudeBot',
  'Amazonbot',
  'DataForSeoBot',
  'BLEXBot',
  'SeekportBot',
  'Barkrowler',
  'serpstatbot',
  'ZoominfoBot',
  'meta-externalagent',
  'ImagesiftBot',
  'Timpibot',
  'OmgiliBot',
] as const

const PATTERN = new RegExp(BLOCKED_BOT_TOKENS.join('|'), 'i')

export function isBlockedBot(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && PATTERN.test(userAgent))
}
