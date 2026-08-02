import { z } from 'zod'

/**
 * Environment schema (PRD 8.4).
 *
 * Two separate schemas so that server-only secrets are never referenced from a
 * module that could be pulled into a Client Component bundle. `serverEnv()` is
 * lazy: importing this file from the browser must never throw.
 */

const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_ANALYTICS_KEY: z.string().optional(),
})

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_FROM: z.email().optional(),
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay', 'stripe']).default('mock'),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  FEATURE_PHONE_AUTH: booleanFlag,
  FEATURE_ONLINE_PAYMENTS: booleanFlag,
  FEATURE_REALTIME_CHAT: booleanFlag,
  /** Off by default: enforcing MFA locks out an admin who has not enrolled. */
  ADMIN_MFA_REQUIRED: booleanFlag,
})

export type ClientEnv = z.infer<typeof clientSchema>
export type ServerEnv = z.infer<typeof serverSchema>

function format(error: z.ZodError): never {
  const lines = error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
  throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`)
}

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` only for statically analysable
 * member expressions, so each key is written out in full rather than looped.
 */
const clientParsed = clientSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_ANALYTICS_KEY: process.env.NEXT_PUBLIC_ANALYTICS_KEY,
})

if (!clientParsed.success) format(clientParsed.error)

export const env: ClientEnv = clientParsed.data

let serverCache: ServerEnv | null = null

/** Server runtime only. Throws if called from the browser bundle. */
export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() must not be called in client code')
  }
  if (serverCache) return serverCache
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) format(parsed.error)
  serverCache = parsed.data
  return serverCache
}
