import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { ServiceError } from '@/lib/action-result'
import { logError } from '@/lib/observability/logger'
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId } from '@/lib/payments/razorpay'
import type { Actor } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { offersAdvance, type AdvanceInput } from '@/features/payments/advance'
import { getEnquiry } from '@/server/dal/enquiries'

/**
 * Start an optional advance on a booking (migration 0044).
 *
 * Creates the Razorpay order and records it as `created` through the
 * customer's own session — RLS admits that insert only for their own enquiry.
 * Nothing here can mark it paid: that happens in the signed webhook alone.
 */
export async function startAdvancePayment(actor: Actor, input: AdvanceInput) {
  if (!actor.userId) throw new ServiceError('unauthorised', 'Sign in to pay.')
  if (!razorpayConfigured()) {
    throw new ServiceError('not_implemented', 'Online payment is not available yet.')
  }

  const enquiry = await getEnquiry(input.enquiryId)
  if (!enquiry || enquiry.customerId !== actor.userId) {
    throw new ServiceError('not_found', 'That booking could not be found.')
  }
  if (!offersAdvance(enquiry.categorySlug)) {
    throw new ServiceError('validation_error', 'Online advance is not offered for this booking.')
  }

  const amountMinor = input.amountRupees * 100
  const currency = 'INR'

  let order
  try {
    order = await createRazorpayOrder({
      amountMinor,
      currency,
      // Razorpay caps receipts at 40 characters.
      receipt: `bk_${enquiry.id.slice(0, 8)}_${Date.now().toString(36)}`,
      notes: { enquiry_id: enquiry.id, vendor_id: enquiry.vendorId },
    })
  } catch (error) {
    logError('payments.createOrder', error, { enquiryId: enquiry.id })
    throw new ServiceError('internal_error', 'We could not start the payment. Please try again.')
  }

  const supabase = (await createClient()) as unknown as SupabaseClient
  const { error } = await supabase.from('booking_payments').insert({
    enquiry_id: enquiry.id,
    customer_id: actor.userId,
    vendor_id: enquiry.vendorId,
    amount_minor: amountMinor,
    currency,
    provider_order_id: order.id,
  })
  if (error) {
    logError('payments.recordOrder', error, { enquiryId: enquiry.id })
    throw new ServiceError('internal_error', 'We could not start the payment. Please try again.')
  }

  return {
    orderId: order.id,
    keyId: razorpayKeyId(),
    amountMinor,
    currency,
    vendorName: enquiry.vendorName,
  }
}
