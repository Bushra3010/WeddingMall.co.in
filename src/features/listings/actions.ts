'use server'

import { revalidatePath } from 'next/cache'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { getActor } from '@/server/dal/actor'
import {
  deleteAvailability,
  deleteMedia,
  deletePackage,
  moderateListingVersion,
  savePackage,
  saveAvailability,
  setCoverMedia,
  submitListing,
  updateMediaAlt,
  uploadMedia,
} from '@/server/services/listings'
import {
  availabilitySchema,
  linesToList,
  listingDecisionSchema,
  mediaUpdateSchema,
  packageSchema,
} from './schema'

/**
 * Listing, package, media, and availability actions.
 *
 * As in Milestone 2, identity and capability come from the session actor — the
 * form only carries which vendor is being edited, and a forged id fails both
 * the capability assert and RLS (PRD 8.3).
 */

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function num(form: FormData, key: string): number | undefined {
  const value = str(form, key)
  return value === '' ? undefined : Number(value)
}

const vendorId = (form: FormData) => str(form, 'vendorId')

export async function submitListingAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('listing.submit', async () => {
    const actor = await getActor()
    return submitListing(actor, vendorId(form))
  })
  if (result.ok) revalidatePath('/vendor-dashboard', 'layout')
  return result
}

export async function savePackageAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction('listing.savePackage', async () => {
    const actor = await getActor()
    const input = packageSchema.parse({
      id: str(form, 'id') || undefined,
      name: str(form, 'name'),
      description: str(form, 'description'),
      categoryId: str(form, 'categoryId'),
      priceType: str(form, 'priceType'),
      minAmount: num(form, 'minAmount'),
      maxAmount: num(form, 'maxAmount'),
      currency: str(form, 'currency') || 'INR',
      unit: str(form, 'unit'),
      inclusions: linesToList(str(form, 'inclusions')),
      exclusions: linesToList(str(form, 'exclusions')),
      active: form.get('active') === 'on',
      sortOrder: str(form, 'sortOrder') || 0,
    })
    return savePackage(actor, vendorId(form), input)
  })
  if (result.ok) revalidatePath('/vendor-dashboard/packages')
  return result
}

export async function deletePackageAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('listing.deletePackage', async () => {
    const actor = await getActor()
    return deletePackage(actor, vendorId(form), str(form, 'packageId'))
  })
  if (result.ok) revalidatePath('/vendor-dashboard/packages')
  return result
}

export async function uploadMediaAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ uploaded: number }>> {
  const result = await runAction('listing.uploadMedia', async () => {
    const actor = await getActor()
    const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length === 0) throw new ServiceError('invalid_file', 'Choose at least one image.')
    if (files.length > 20) {
      throw new ServiceError('invalid_file', 'Upload up to 20 images at a time.')
    }

    const altText = str(form, 'altText') || undefined
    // Sequential rather than parallel: the cover-selection logic reads the
    // current count, and concurrent inserts would race on it.
    for (const file of files) {
      await uploadMedia(actor, vendorId(form), file, altText)
    }
    return { uploaded: files.length }
  })
  if (result.ok) revalidatePath('/vendor-dashboard/portfolio')
  return result
}

export async function updateMediaAltAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('listing.updateMediaAlt', async () => {
    const actor = await getActor()
    const input = mediaUpdateSchema.parse({
      mediaId: str(form, 'mediaId'),
      altText: str(form, 'altText'),
    })
    return updateMediaAlt(actor, vendorId(form), input.mediaId, input.altText)
  })
  if (result.ok) revalidatePath('/vendor-dashboard/portfolio')
  return result
}

export async function setCoverAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('listing.setCover', async () => {
    const actor = await getActor()
    return setCoverMedia(actor, vendorId(form), str(form, 'mediaId'))
  })
  if (result.ok) revalidatePath('/vendor-dashboard/portfolio')
  return result
}

export async function deleteMediaAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('listing.deleteMedia', async () => {
    const actor = await getActor()
    return deleteMedia(actor, vendorId(form), str(form, 'mediaId'))
  })
  if (result.ok) revalidatePath('/vendor-dashboard/portfolio')
  return result
}

export async function saveAvailabilityAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('listing.saveAvailability', async () => {
    const actor = await getActor()
    const input = availabilitySchema.parse({
      startDate: str(form, 'startDate'),
      endDate: str(form, 'endDate'),
      status: str(form, 'status'),
      note: str(form, 'note'),
    })
    return saveAvailability(actor, vendorId(form), input)
  })
  if (result.ok) revalidatePath('/vendor-dashboard/availability')
  return result
}

export async function deleteAvailabilityAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean }>> {
  const result = await runAction('listing.deleteAvailability', async () => {
    const actor = await getActor()
    return deleteAvailability(actor, vendorId(form), str(form, 'entryId'))
  })
  if (result.ok) revalidatePath('/vendor-dashboard/availability')
  return result
}

export async function moderateListingAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ ok: boolean; decision: string }>> {
  const result = await runAction('listing.moderate', async () => {
    const actor = await getActor()
    const input = listingDecisionSchema.parse({
      versionId: str(form, 'versionId'),
      decision: str(form, 'decision'),
      reason: str(form, 'reason'),
    })
    return moderateListingVersion(actor, input.versionId, input.decision, input.reason)
  })
  if (result.ok) revalidatePath('/admin/listings')
  return result
}
