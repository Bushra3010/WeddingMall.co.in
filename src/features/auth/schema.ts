import { z } from 'zod'

/** Validation at the mutation boundary (PRD 10.3). */

export const emailSchema = z.email('Enter a valid email address').max(254).toLowerCase().trim()

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use fewer than 128 characters')
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
    message: 'Include at least one letter and one number',
  })

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
  next: z.string().startsWith('/').optional().catch(undefined),
})

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(80),
  email: emailSchema,
  password: passwordSchema,
  // Terms acceptance is recorded with its policy version (PRD 6.4, 14.3).
  acceptTerms: z.literal(true, { message: 'You must accept the terms to continue' }),
  next: z.string().startsWith('/').optional().catch(undefined),
})

export const resetRequestSchema = z.object({ email: emailSchema })

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>

/** Bumped whenever the published policies change. */
export const CURRENT_POLICY_VERSION = '2026-07-30'

/**
 * `next` comes from a query string, so it must be treated as untrusted: only a
 * same-site absolute path is allowed, never a protocol-relative `//host`.
 */
export function safeRedirect(next: string | undefined | null, fallback = '/account'): string {
  if (!next) return fallback
  if (!next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}
