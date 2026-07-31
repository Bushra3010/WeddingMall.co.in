'use server'

import { runAction, type ActionResult } from '@/lib/action-result'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActor } from '@/server/dal/actor'
import { getDocumentSignedUrl } from '@/server/services/verification'
import { logError } from '@/lib/observability/logger'

/**
 * Mints a short-lived signed URL for a private verification document.
 *
 * Separate from `actions.ts` because this one takes an id rather than FormData
 * — it is called from a click handler, not a form submission.
 */
export async function openDocumentAction(
  documentId: string,
): Promise<ActionResult<{ url: string }>> {
  return runAction('vendor.openDocument', async (requestId) => {
    const actor = await getActor()
    const url = await getDocumentSignedUrl(actor, documentId)

    /*
     * Opening a verification document is a PII reveal and must be audited
     * (PRD 10.3). Written with the service-role client because audit_logs has
     * no user-facing insert policy — it is append-only infrastructure.
     *
     * A failure to audit must not silently succeed the reveal, so this is
     * awaited and logged loudly if it fails.
     */
    const { error } = await createAdminClient().from('audit_logs').insert({
      actor_user_id: actor.userId,
      actor_type: 'admin',
      action: 'vendor.document_viewed',
      entity_type: 'vendor_document',
      entity_id: documentId,
      request_id: requestId,
    })

    if (error) logError('audit.document_viewed', error, { documentId, requestId })

    return { url }
  })
}
