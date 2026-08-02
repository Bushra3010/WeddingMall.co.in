'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { runAction, type ActionResult } from '@/lib/action-result'
import { getActor } from '@/server/dal/actor'
import { assertVendorCapability } from '@/lib/permissions'
import { startCheckout } from '@/server/services/billing'

/** Billing actions (PRD 6.10). */

const checkoutSchema = z.object({
  vendorId: z.uuid(),
  planCode: z.string().trim().min(1),
})

/**
 * Starts a checkout. Deliberately does not write a subscription — only the
 * provider webhook grants entitlement, so a caller replaying this action gains
 * nothing but another payment link.
 */
export async function startCheckoutAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ url: string }>> {
  const result = await runAction('billing.checkout', async () => {
    const actor = await getActor()
    const input = checkoutSchema.parse({
      vendorId: String(form.get('vendorId') ?? ''),
      planCode: String(form.get('planCode') ?? ''),
    })

    // Paying is a billing action, not a listing one.
    assertVendorCapability(actor, input.vendorId, 'billing.manage')

    const session = await startCheckout(actor, input.vendorId, input.planCode)
    return { url: session.url }
  })

  if (result.ok) redirect(result.data.url)
  return result
}
