import type { MetadataRoute } from 'next'

import { BLOCKED_BOT_TOKENS } from '@/lib/bots'
import { absoluteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Dashboards, auth, and open-ended search combinations (PRD 11.1).
        disallow: [
          '/account',
          '/vendor-dashboard',
          '/admin',
          '/auth',
          '/api',
          '/vendors?',
          '/vendors/*?',
        ],
      },
      // Scrapers that bring no visitors; the proxy also answers them with 403.
      { userAgent: [...BLOCKED_BOT_TOKENS], disallow: '/' },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
