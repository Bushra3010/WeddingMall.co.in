import type { NextConfig } from 'next'

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined

/**
 * Security headers (PRD 10.3). A full CSP with a per-request nonce is a
 * Milestone 7 task — these are the headers that can be set safely today
 * without breaking Next's inline bootstrap script.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    /*
     * Every file in this application is uploaded through a Server Action, and
     * Next caps a Server Action request body at **1 MB** by default.
     *
     * The application's own limits are 10 MB — `MAX_IMAGE_BYTES` for portfolio
     * photos and `MAX_DOCUMENT_BYTES` for verification documents — and the
     * `vendor-media` and `vendor-documents` buckets are both configured for 10
     * MB too. So the framework was rejecting anything over 1 MB before the
     * action ran: a portfolio upload of a normal phone photo failed with
     * nothing in the server log, because `uploadMedia` was never reached.
     *
     * 12 MB, not 10: the limit applies to the whole multipart body, which
     * carries the other form fields and per-part boundaries alongside the file.
     * A 10 MB image in a body capped at exactly 10 MB fails on the overhead,
     * and the error names the body rather than the file that caused it.
     *
     * The real limits stay where they are enforceable — the size check in
     * `uploadMedia`/`uploadVerificationDocument`, which returns a message
     * naming the actual cap, and the bucket's own `file_size_limit` behind it.
     * This only stops the framework refusing first and less clearly.
     */
    serverActions: { bodySizeLimit: '12mb' },
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    /*
     * Next 16 refuses any `quality` not listed here with a 400 — the default
     * allows 75 alone, so `<Image quality={90}>` does not render a softer
     * image, it renders no image. 90 is here for the hero, where the artwork is
     * already being upscaled and compression softness compounds with it.
     */
    qualities: [75, 90],
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
