'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { assertPermission } from '@/lib/permissions'
import { getActor } from '@/server/dal/actor'
import {
  createVendorAsAdmin,
  deleteVendorAsAdmin,
  updateVendorAsAdmin,
} from '@/server/services/admin-vendors'
import { writeAttributeValues } from '@/server/services/vendor-attributes'
import { adminCreateVendorSchema, adminVendorSchema } from '@/features/vendors/schema'

/**
 * Admin vendor management (PRD 6.11).
 *
 * Approve, reject, suspend, and reactivate are **not** here — they already
 * exist as `decideVendorAction` in `features/vendors/actions.ts` and go through
 * `admin_decide_vendor()`. They were working the whole time; they were just
 * unreachable from the vendor list. Adding a second path to them would have
 * given the audit log two names for the same decision.
 */

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function saveAdminVendorAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ vendorId: string }>> {
  const result = await runAction('admin.saveVendor', async () => {
    const actor = await getActor()
    const input = adminVendorSchema.parse({
      vendorId: str(form, 'vendorId'),
      displayName: str(form, 'displayName'),
      legalName: str(form, 'legalName'),
      slug: str(form, 'slug'),
      primaryCityId: str(form, 'primaryCityId'),
      email: str(form, 'email'),
      phone: str(form, 'phone'),
      website: str(form, 'website'),
      foundedYear: str(form, 'foundedYear') || undefined,
      about: str(form, 'about'),
    })

    return updateVendorAsAdmin(actor, input)
  })

  if (result.ok) {
    revalidatePath('/admin/vendors')
    revalidatePath(`/admin/vendors/${result.data.vendorId}`)
    // A renamed or re-slugged business changes what the public site serves.
    revalidatePath('/vendors')
    revalidatePath('/')
  }
  return result
}

/**
 * Create a business from the admin panel (migration 0039).
 *
 * Returns the new id rather than redirecting. The form needs to say what
 * happened — live, or saved as a draft; owned by the person named, or held by
 * the admin who made it — and a redirect would throw that away, leaving the
 * admin on a vendor page with no idea whether the listing is public.
 */
export async function createAdminVendorAction(
  _prev: unknown,
  form: FormData,
): Promise<
  ActionResult<{ vendorId: string; slug: string; status: string; ownerIsCreator: boolean }>
> {
  const result = await runAction('admin.createVendor', async () => {
    const actor = await getActor()
    const input = adminCreateVendorSchema.parse({
      displayName: str(form, 'displayName'),
      slug: str(form, 'slug'),
      primaryCategoryId: str(form, 'primaryCategoryId'),
      primaryCityId: str(form, 'primaryCityId'),
      about: str(form, 'about'),
      email: str(form, 'email'),
      phone: str(form, 'phone'),
      website: str(form, 'website'),
      ownerEmail: str(form, 'ownerEmail'),
      // An unchecked checkbox is absent from FormData entirely, so this is
      // "present and on" rather than a string comparison against something that
      // may not be there.
      publish: form.get('publish') === 'on',
    })

    return createVendorAsAdmin(actor, input)
  })

  if (result.ok) {
    revalidatePath('/admin/vendors')
    // A published business changes the public site immediately — it went live
    // without passing through the review queue, so nothing else will revalidate
    // these for us.
    revalidatePath('/vendors')
    revalidatePath('/')
  }
  return result
}

/**
 * Delete a business.
 *
 * Redirects on success rather than revalidating in place: this is reachable
 * from the detail page of the row it removes, and re-rendering that page would
 * 404 the admin who just used it.
 */
export async function deleteAdminVendorAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const from = str(form, 'redirectTo')

  const result = await runAction('admin.deleteVendor', async () => {
    const actor = await getActor()
    const id = str(form, 'id')
    if (!id) throw new ServiceError('validation_error', 'Missing business.')

    return deleteVendorAsAdmin(actor, id)
  })

  if (result.ok) {
    revalidatePath('/admin/vendors')
    revalidatePath('/vendors')
    revalidatePath('/')
    // Only ever an in-app admin path, never a value from the form that could
    // point somewhere else.
    if (from === 'detail') redirect('/admin/vendors')
  }
  return result
}

/**
 * Answer a vendor's category attributes on their behalf (PRD 6.2).
 *
 * The same write the vendor's own Services form performs, under a different
 * right: `listing.moderate`, mirroring `vendor_attribute_values: admin manage`
 * in migration 0041, so this refuses exactly what RLS would refuse rather than
 * failing opaquely at the database. The vendor slug is only used to revalidate
 * the public page, whose
 * `revalidate = 600` would otherwise hold a stale grid for ten minutes.
 */
export async function saveAdminVendorAttributesAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ saved: number }>> {
  const vendorSlug = str(form, 'vendorSlug')

  const result = await runAction('admin.saveVendorAttributes', async () => {
    const actor = await getActor()
    const vendorId = str(form, 'vendorId')
    if (!vendorId) throw new ServiceError('validation_error', 'Missing business.')
    assertPermission(actor, 'listing.moderate')

    const { saved } = await writeAttributeValues(vendorId, form)
    return { saved }
  })

  if (result.ok) {
    revalidatePath(`/admin/vendors/${str(form, 'vendorId')}`)
    if (vendorSlug) revalidatePath(`/vendor/${vendorSlug}`)
    revalidatePath('/vendors')
  }
  return result
}
