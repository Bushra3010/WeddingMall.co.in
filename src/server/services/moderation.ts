import 'server-only'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { ServiceError } from '@/lib/action-result'
import { assertPermission, type Actor } from '@/lib/permissions'
import type { AdminDecisionInput } from '@/features/vendors/schema'

/**
 * Admin moderation (PRD 6.11, Epic E).
 *
 * The decision itself runs in `admin_decide_vendor()` so the publication
 * state, verification state, search index, and audit entry move together. This
 * service adds the permission pre-check, the friendly error, and cache
 * revalidation.
 */

export async function decideVendor(actor: Actor, input: AdminDecisionInput) {
  // Pre-check for a clean error; the RPC re-checks as the real boundary.
  if (input.decision === 'suspend' || input.decision === 'reactivate') {
    assertPermission(actor, 'vendor.suspend')
  } else {
    assertPermission(actor, 'vendor.verify')
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_decide_vendor', {
    target_vendor: input.vendorId,
    decision: input.decision,
    reason: input.reason?.trim() || null,
  })

  if (error) {
    if (error.code === 'P0001' || error.code === 'P0002') {
      throw new ServiceError('invalid_state', error.message)
    }
    if (error.code === '42501') {
      throw new ServiceError('forbidden', error.message)
    }
    throw new ServiceError('internal_error', 'We could not record that decision.')
  }

  // A published or unpublished vendor changes what the public site shows
  // (PRD 8.3 — revalidate after moderation).
  const { data: vendor } = await supabase
    .from('vendors')
    .select('slug')
    .eq('id', input.vendorId)
    .maybeSingle()

  revalidatePath('/')
  revalidatePath('/vendors')
  if (vendor?.slug) revalidatePath(`/vendor/${vendor.slug}`)

  return { ok: true, decision: input.decision }
}
