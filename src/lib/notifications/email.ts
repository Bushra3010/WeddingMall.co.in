import 'server-only'

import { serverEnv } from '@/lib/env'
import { log, logError } from '@/lib/observability/logger'

/**
 * Email provider adapter (PRD 12.1).
 *
 * No provider-specific call happens outside this module. Until
 * `EMAIL_PROVIDER_API_KEY` is configured the console provider is used, which
 * logs a redacted record instead of sending — so the rest of the system can be
 * built and tested without a live provider, and nothing silently disappears.
 */

export interface EmailMessage {
  to: string
  subject: string
  body: string
  templateCode?: string
}

export interface DeliveryResult {
  ok: boolean
  providerMessageId?: string
  error?: string
}

export interface EmailProvider {
  readonly name: string
  send(input: EmailMessage): Promise<DeliveryResult>
}

/** Logs rather than sends. The address is truncated — PRD 10.1 forbids
 * unnecessary PII in logs. */
const consoleProvider: EmailProvider = {
  name: 'console',
  async send(input) {
    const [local, domain] = input.to.split('@')
    log.info('email.not_sent', {
      provider: 'console',
      template: input.templateCode,
      subject: input.subject,
      recipient: `${local?.slice(0, 2) ?? ''}***@${domain ?? ''}`,
    })
    return { ok: true, providerMessageId: `console-${crypto.randomUUID()}` }
  },
}

/**
 * Resend is the PRD's recommended default (8.1). Implemented behind the same
 * interface so swapping providers is a one-line change here.
 */
function resendProvider(apiKey: string, from: string): EmailProvider {
  return {
    name: 'resend',
    async send(input) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [input.to],
            subject: input.subject,
            text: input.body,
          }),
        })

        if (!res.ok) {
          const detail = await res.text()
          return { ok: false, error: `${res.status}: ${detail.slice(0, 200)}` }
        }

        const data = (await res.json()) as { id?: string }
        return { ok: true, providerMessageId: data.id }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'send failed' }
      }
    },
  }
}

export function emailProvider(): EmailProvider {
  const env = serverEnv()
  if (env.EMAIL_PROVIDER_API_KEY && env.EMAIL_FROM) {
    return resendProvider(env.EMAIL_PROVIDER_API_KEY, env.EMAIL_FROM)
  }
  return consoleProvider
}

/**
 * Send, and never let a delivery failure escape.
 *
 * PRD 14.2: "no notification failure may roll back the underlying successful
 * business transaction." Callers treat this as fire-and-forget.
 */
export async function sendEmail(input: EmailMessage): Promise<DeliveryResult> {
  try {
    const provider = emailProvider()
    const result = await provider.send(input)
    if (!result.ok) {
      logError('email.send_failed', new Error(result.error ?? 'unknown'), {
        provider: provider.name,
        template: input.templateCode,
      })
    }
    return result
  } catch (error) {
    logError('email.send_threw', error, { template: input.templateCode })
    return { ok: false, error: 'send failed' }
  }
}
