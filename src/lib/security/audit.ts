import 'server-only'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'

import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/observability/logger'

/**
 * Audit trail (PRD 10.3: "Audit all admin decisions, PII reveals, exports,
 * role changes, suspensions, and billing overrides").
 *
 * Written with the service-role client because `audit_logs` has a read policy
 * and no write policy — an actor must not be able to edit or suppress the
 * record of what they did. That is the whole point of an audit log, and it is
 * why this is one of the permitted service-role callers.
 */

export type AuditAction =
  | 'pii.reveal'
  | 'data.export'
  | 'review.moderate'
  | 'vendor.moderate'
  | 'billing.override'
  | 'role.change'

/**
 * The IP is hashed, not stored.
 *
 * An audit log is retained for a long time and read by people investigating
 * something else. A salted hash still answers "was this the same visitor?"
 * without turning the table into a store of personal data (PRD 14.3).
 */
async function hashedIp(): Promise<string | null> {
  try {
    const store = await headers()
    const forwarded = store.get('x-forwarded-for') ?? ''
    const ip = forwarded.split(',')[0]?.trim() || store.get('x-real-ip') || ''
    if (!ip) return null
    // Salted with a value that is not in the table, so the column cannot be
    // reversed by hashing the IPv4 space.
    const salt = process.env.CRON_SECRET ?? 'wm-audit'
    return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
  } catch {
    return null
  }
}

export interface AuditEntry {
  action: AuditAction
  entityType: string
  entityId?: string | null
  actorUserId?: string | null
  actorType?: 'admin' | 'vendor' | 'customer' | 'system'
  before?: unknown
  after?: unknown
  reason?: string | null
  requestId?: string | null
}

/**
 * Never throws.
 *
 * A failure to record an audit line must not roll back or block the action it
 * describes — refusing a legitimate moderation decision because the log was
 * unreachable is the worse failure. The write failure is logged loudly so it
 * cannot pass unnoticed.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('audit_logs').insert({
      actor_user_id: entry.actorUserId ?? null,
      actor_type: entry.actorType ?? 'admin',
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      before_json: entry.before === undefined ? null : (entry.before as never),
      after_json: entry.after === undefined ? null : (entry.after as never),
      reason: entry.reason ?? null,
      ip_hash: await hashedIp(),
      request_id: entry.requestId ?? null,
    })
    if (error) throw error
  } catch (error) {
    logError('security.audit', error, { action: entry.action, entityType: entry.entityType })
  }
}
