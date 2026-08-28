import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ServiceError } from '@/lib/action-result'
import { assertPermission, can, type Actor } from '@/lib/permissions'
import { audit } from '@/lib/security/audit'
import { describeDeleteError } from '@/features/admin/delete-errors'
import type { AdminVendorInput } from '@/features/vendors/schema'

/**
 * Admin edit and delete for a business (PRD 6.11, Epic E).
 *
 * The moderation *decisions* — approve, reject, suspend, reactivate — already
 * live in `moderation.ts` behind `admin_decide_vendor()`. Nothing here
 * duplicates them: this covers the two things an admin could not do at all,
 * correcting a vendor's details and removing a business outright.
 *
 * As everywhere else, the permission check here exists to produce a good error.
 * RLS is the boundary: `vendors: admin moderate` (0008) decides who may update
 * and `vendors: admin delete` (0035) decides who may delete.
 */

/**
 * Correct a business's details on the vendor's behalf.
 *
 * Two tables, not one, because `about` lives on `vendor_listings` — and the two
 * are gated on different permissions (`vendor.verify`/`vendor.suspend` for the
 * business, `listing.moderate` for the listing), so an admin can hold one and
 * not the other. The listing write is therefore attempted only when there is
 * something to write, and a refusal on it is reported rather than swallowed.
 */
export async function updateVendorAsAdmin(actor: Actor, input: AdminVendorInput) {
  // Mirrors the `vendors: admin moderate` policy: either permission grants the
  // UPDATE, so requiring both here would refuse writes RLS would have allowed.
  if (!can(actor, 'vendor.verify') && !can(actor, 'vendor.suspend')) {
    throw new ServiceError('forbidden', 'You do not have permission to edit this business.')
  }

  const supabase = await createClient()

  const { error, count } = await supabase
    .from('vendors')
    .update(
      {
        display_name: input.displayName,
        legal_name: input.legalName || null,
        slug: input.slug,
        primary_city_id: input.primaryCityId,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        founded_year: input.foundedYear ?? null,
      },
      { count: 'exact' },
    )
    .eq('id', input.vendorId)

  if (error) {
    // Renaming into a slug another business already holds. The unique index is
    // the only thing that can answer this: a pre-flight lookup runs under RLS
    // and cannot see a row it is about to collide with (see `uniqueSlug`).
    if (error.code === '23505') {
      throw new ServiceError('conflict', 'That web address is already used by another business.', {
        slug: ['Already taken — try a different one.'],
      })
    }
    if (error.code === '42501') {
      throw new ServiceError('forbidden', 'You do not have permission to edit this business.')
    }
    throw new ServiceError('internal_error', 'We could not save those changes.')
  }

  // An UPDATE that RLS filters out reports success with zero rows. Saying
  // "saved" to an admin whose change was silently dropped is worse than an
  // error, so the count is checked rather than assumed.
  if (count === 0) {
    throw new ServiceError('not_found', 'That business no longer exists, or you cannot edit it.')
  }

  const about = input.about?.trim() ?? ''
  const { error: listingError } = await supabase
    .from('vendor_listings')
    .update({ about: about || null })
    .eq('vendor_id', input.vendorId)

  if (listingError) {
    if (listingError.code === '42501') {
      throw new ServiceError(
        'forbidden',
        'The business details were saved, but changing the description needs the listing.moderate permission.',
      )
    }
    throw new ServiceError(
      'internal_error',
      'The business details were saved, but the description could not be.',
    )
  }

  return { vendorId: input.vendorId }
}

/**
 * Delete a business.
 *
 * The decision about whether this is allowed lives in `delete_vendor()`
 * (migration 0035), not here, for the reason `delete_city()` gives: fifteen
 * tables carry a `vendor_id` and thirteen of them cascade, so counting in
 * TypeScript leaves a window between the count and the delete in which an
 * enquiry can arrive. The function takes `for update` on the row first, which
 * an FK insert cannot cross.
 *
 * That means the refusal an admin reads is written in SQL. It is safe to
 * surface: it names counts and the business, never a row belonging to a
 * customer.
 */
export async function deleteVendorAsAdmin(actor: Actor, vendorId: string) {
  assertPermission(actor, 'admin.manage')

  const supabase = await createClient()

  /*
   * Read the business before it stops existing, so the audit entry can name it.
   * An entry that says only "some uuid was deleted" answers none of the
   * questions anyone asks afterwards.
   */
  const { data: before } = await supabase
    .from('vendors')
    .select('display_name, slug, status')
    .eq('id', vendorId)
    .maybeSingle()

  /*
   * `delete_vendor` arrives with migration 0035 and enters the generated types
   * on the next `npm run db:types`. Until that regeneration runs the `rpc()`
   * overload does not know the name, and `src/types/database.ts` is generated —
   * hand-editing it is forbidden (CLAUDE.md invariant 4) and would be undone by
   * the next generation anyway.
   *
   * **The cast is on the client, not on the method, and that matters.** Writing
   * `const rpc = supabase.rpc as ...` reads as the narrower, tidier version of
   * this and is broken: it detaches the function from its receiver, and
   * supabase-js's `rpc` reads `this.rest`. That shipped, and every delete died
   * with "Cannot read properties of undefined (reading 'rest')" — a TypeError,
   * so it never reached `describeDeleteError` and surfaced to admins as the
   * generic "something went wrong on our side". Keep the call a method call.
   *
   * Typed on the way out so the error handling below stays checked. Delete the
   * cast once the types have been refreshed; the call itself is already right.
   */
  const client = supabase as unknown as {
    rpc: (
      name: 'delete_vendor',
      args: { p_id: string },
    ) => Promise<{ error: { code?: string | null; message?: string | null } | null }>
  }

  const { error } = await client.rpc('delete_vendor', { p_id: vendorId })

  if (error) {
    const failure = describeDeleteError(error, 'We could not delete that business.')
    throw new ServiceError(failure.code, failure.message)
  }

  /*
   * Written after the delete, unlike the customer one — and for the opposite
   * reason. `delete_vendor()` refuses far more often than it succeeds (any
   * enquiry, payment, review or subscription stops it), so auditing first would
   * fill the log with deletions that never happened. The customer path has its
   * refusals in TypeScript, before the audit, so it does not have that problem.
   *
   * `void` so a failed audit write cannot fail a delete that already happened.
   */
  void audit({
    action: 'vendor.delete',
    entityType: 'vendor',
    entityId: vendorId,
    actorUserId: actor.userId,
    before: before ?? undefined,
    after: { deleted: true },
  })

  return { id: vendorId }
}
