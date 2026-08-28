'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { getActor } from '@/server/dal/actor'
import { deleteVendorAsAdmin, updateVendorAsAdmin } from '@/server/services/admin-vendors'
import { adminVendorSchema } from '@/features/vendors/schema'

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
