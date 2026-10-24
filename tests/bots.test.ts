import { describe, expect, it } from 'vitest'

import { BLOCKED_BOT_TOKENS, isBlockedBot } from '@/lib/bots'

describe('isBlockedBot', () => {
  it('matches every listed scraper, case-insensitively', () => {
    for (const token of BLOCKED_BOT_TOKENS) {
      expect(isBlockedBot(`Mozilla/5.0 (compatible; ${token}/1.0; +https://example)`)).toBe(true)
      expect(isBlockedBot(token.toLowerCase())).toBe(true)
    }
  })

  it('lets search engines, previews and browsers through', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'WhatsApp/2.23.20.0',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
    ]) {
      expect(isBlockedBot(ua)).toBe(false)
    }
  })

  it('treats a missing user agent as not a bot', () => {
    expect(isBlockedBot(null)).toBe(false)
    expect(isBlockedBot('')).toBe(false)
  })
})
