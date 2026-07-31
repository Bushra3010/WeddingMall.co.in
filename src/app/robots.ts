import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Dashboards, auth, and open-ended search combinations (PRD 11.1).
        disallow: ['/account', '/vendor-dashboard', '/admin', '/auth', '/api', '/vendors?'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
