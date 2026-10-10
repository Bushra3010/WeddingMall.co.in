'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { getActor } from '@/server/dal/actor'
import {
  addEnquiryNote,
  markNotificationsRead,
  saveWeddingProfile,
  sendMessage,
  submitEnquiry,
  toggleShortlist,
  transitionEnquiry,
  updateEnquiryCrm,
  updateShortlistNote,
} from '@/server/services/enquiries'
import {
  bookingMessage,
  bookingSchema,
  enquiryCrmSchema,
  enquiryNoteSchema,
  enquirySchema,
  messageSchema,
  shortlistSchema,
  transitionSchema,
  weddingProfileSchema,
} from './schema'

/** Customer marketplace actions (PRD 6.5–6.7). */

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function num(form: FormData, key: string): number | undefined {
  const value = str(form, key)
  return value === '' ? undefined : Number(value)
}

function strList(form: FormData, key: string): string[] {
  return form.getAll(key).filter((v): v is string => typeof v === 'string' && v.length > 0)
}

export async function submitEnquiryAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ enquiryId: string; duplicate: boolean; duplicateWarning: boolean }>> {
  let enquiryId: string | null = null

  const result = await runAction('enquiry.submit', async () => {
    const actor = await getActor()
    const input = enquirySchema.parse({
      vendorId: str(form, 'vendorId'),
      categoryId: str(form, 'categoryId'),
      cityId: str(form, 'cityId'),
      eventDate: str(form, 'eventDate'),
      flexibleDate: str(form, 'flexibleDate'),
      budgetMinMinor: num(form, 'budgetMin'),
      budgetMaxMinor: num(form, 'budgetMax'),
      guestCount: num(form, 'guestCount'),
      message: str(form, 'message'),
      preferredContactMode: str(form, 'preferredContactMode') || 'in_app',
      contactConsent: form.get('contactConsent') === 'on',
      // Generated per form render, so a double submit lands on the same key
      // and the RPC returns the original enquiry (PRD 10.3).
      idempotencyKey: str(form, 'idempotencyKey'),
    })
    const out = await submitEnquiry(actor, input)
    enquiryId = out.enquiryId
    return out
  })

  if (result.ok && enquiryId) {
    revalidatePath('/account/enquiries')
    redirect(`/account/enquiries/${enquiryId}?sent=1`)
  }
  return result
}

/**
 * "Book now" — no quote, no payment. Validated as a booking, then submitted
 * through the same enquiry RPC so the vendor's inbox, notifications and the
 * thread all work unchanged.
 */
export async function submitBookingAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ enquiryId: string; duplicate: boolean; duplicateWarning: boolean }>> {
  let enquiryId: string | null = null

  const result = await runAction('enquiry.book', async () => {
    const actor = await getActor()
    const booking = bookingSchema.parse({
      vendorId: str(form, 'vendorId'),
      categoryId: str(form, 'categoryId'),
      cityId: str(form, 'cityId'),
      eventDate: str(form, 'eventDate'),
      eventTime: str(form, 'eventTime'),
      guestCount: num(form, 'guestCount'),
      note: str(form, 'note'),
      contactConsent: form.get('contactConsent') === 'on',
      idempotencyKey: str(form, 'idempotencyKey'),
    })

    // A booking for a day that has already passed is a typo, not a booking.
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    if (booking.eventDate < today) {
      throw new ServiceError('validation_error', 'Choose a date from today onwards.', {
        eventDate: ['Choose a date from today onwards'],
      })
    }

    const input = enquirySchema.parse({
      vendorId: booking.vendorId,
      categoryId: booking.categoryId,
      cityId: booking.cityId,
      eventDate: booking.eventDate,
      guestCount: booking.guestCount,
      message: bookingMessage({
        eventDate: booking.eventDate,
        eventTime: booking.eventTime || undefined,
        guestCount: booking.guestCount,
        note: booking.note,
      }),
      preferredContactMode: 'phone',
      contactConsent: true,
      idempotencyKey: booking.idempotencyKey,
    })
    const out = await submitEnquiry(actor, input)
    enquiryId = out.enquiryId
    return out
  })

  if (result.ok && enquiryId) {
    revalidatePath('/account/enquiries')
    redirect(`/account/enquiries/${enquiryId}?booked=1`)
  }
  return result
}

export async function sendMessageAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('enquiry.sendMessage', async () => {
    const actor = await getActor()
    const input = messageSchema.parse({
      enquiryId: str(form, 'enquiryId'),
      body: str(form, 'body'),
    })
    return sendMessage(actor, input.enquiryId, input.body)
  })

  if (result.ok) {
    revalidatePath(`/account/enquiries/${str(form, 'enquiryId')}`)
    revalidatePath(`/vendor-dashboard/enquiries/${str(form, 'enquiryId')}`)
  }
  return result
}

export async function transitionEnquiryAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean; status: string }>> {
  const result = await runAction('enquiry.transition', async () => {
    const actor = await getActor()
    const input = transitionSchema.parse({
      enquiryId: str(form, 'enquiryId'),
      status: str(form, 'status'),
      reason: str(form, 'reason'),
    })
    return transitionEnquiry(actor, input.enquiryId, input.status, input.reason)
  })

  if (result.ok) {
    revalidatePath(`/account/enquiries/${str(form, 'enquiryId')}`)
    revalidatePath(`/vendor-dashboard/enquiries/${str(form, 'enquiryId')}`)
  }
  return result
}

export async function saveWeddingProfileAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction('customer.saveWeddingProfile', async () => {
    const actor = await getActor()
    const input = weddingProfileSchema.parse({
      displayLabel: str(form, 'displayLabel'),
      weddingDate: str(form, 'weddingDate'),
      flexibleMonth: str(form, 'flexibleMonth'),
      primaryCityId: str(form, 'primaryCityId'),
      budgetMinMinor: num(form, 'budgetMin'),
      budgetMaxMinor: num(form, 'budgetMax'),
      guestCount: num(form, 'guestCount'),
      notes: str(form, 'notes'),
      requiredCategoryIds: strList(form, 'requiredCategoryIds'),
    })
    return saveWeddingProfile(actor, input)
  })

  if (result.ok) revalidatePath('/account', 'layout')
  return result
}

export async function toggleShortlistAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ shortlisted: boolean }>> {
  const result = await runAction('customer.toggleShortlist', async () => {
    const actor = await getActor()
    const input = shortlistSchema.parse({
      vendorId: str(form, 'vendorId'),
      note: str(form, 'note'),
    })
    return toggleShortlist(actor, input.vendorId, input.note)
  })

  if (result.ok) {
    revalidatePath('/account/shortlist')
    const slug = str(form, 'vendorSlug')
    if (slug) revalidatePath(`/vendor/${slug}`)
  }
  return result
}

export async function updateShortlistNoteAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('customer.updateShortlistNote', async () => {
    const actor = await getActor()
    return updateShortlistNote(actor, str(form, 'vendorId'), str(form, 'note'))
  })

  if (result.ok) revalidatePath('/account/shortlist')
  return result
}

export async function markNotificationsReadAction(
  _prev: unknown,
  _form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('customer.markNotificationsRead', async () => {
    const actor = await getActor()
    return markNotificationsRead(actor)
  })

  if (result.ok) revalidatePath('/account/notifications')
  return result
}

export async function addEnquiryNoteAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ enquiryId: string }>> {
  const result = await runAction('vendor.addEnquiryNote', async () => {
    const actor = await getActor()
    const input = enquiryNoteSchema.parse({
      enquiryId: str(form, 'enquiryId'),
      note: str(form, 'note'),
      followUpAt: str(form, 'followUpAt'),
    })
    return addEnquiryNote(actor, input)
  })

  if (result.ok) revalidatePath(`/vendor-dashboard/enquiries/${result.data.enquiryId}`)
  return result
}

export async function updateEnquiryCrmAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ enquiryId: string }>> {
  const result = await runAction('vendor.updateEnquiryCrm', async () => {
    const actor = await getActor()
    const input = enquiryCrmSchema.parse({
      enquiryId: str(form, 'enquiryId'),
      quoteAmount: str(form, 'quoteAmount'),
      lostReason: str(form, 'lostReason'),
    })
    return updateEnquiryCrm(actor, input)
  })

  if (result.ok) revalidatePath(`/vendor-dashboard/enquiries/${result.data.enquiryId}`)
  return result
}
