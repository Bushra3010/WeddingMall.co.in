'use server'

import { runAction, type ActionResult } from '@/lib/action-result'
import { getActor } from '@/server/dal/actor'
import { startAdvancePayment } from '@/server/services/booking-payments'

import { advanceSchema } from './advance'

/** Starts an optional advance on a booking; the browser then opens Checkout. */
export async function startAdvancePaymentAction(
  _prev: unknown,
  form: FormData,
): Promise<
  ActionResult<{
    orderId: string
    keyId: string
    amountMinor: number
    currency: string
    vendorName: string
  }>
> {
  return runAction('payments.startAdvance', async () => {
    const actor = await getActor()
    const input = advanceSchema.parse({
      enquiryId: form.get('enquiryId'),
      amountRupees: form.get('amountRupees'),
    })
    return startAdvancePayment(actor, input)
  })
}
