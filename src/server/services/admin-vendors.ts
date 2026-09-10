import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ServiceError } from '@/lib/action-result'
import { assertPermission, can, type Actor } from '@/lib/permissions'
import { audit } from '@/lib/security/audit'
import { describeDeleteError } from '@/features/admin/delete-errors'
import { describeCreateVendorError } from '@/features/admin/vendor-create-errors'
import type { AdminCreateVendorInput, AdminVendorInput } from '@/features/vendors/schema'

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
 * Create a business on an admin's behalf, optionally publishing it immediately
 * (migration 0039).
 *
 * ## Why this is one RPC and not a sequence of inserts
 *
 * Four things block the obvious version. `vendors: create own` requires
 * `auth.uid() = owner_user_id`, so an admin cannot insert a row owned by the
 * vendor. `vendors.status` may only open at `draft` or `pending_review`, and the
 * 0022 column guard refuses an *update* to `status` — so "create it, then
 * activate it" is not reachable either. A published business needs five rows
 * written together plus an approved `vendor_listing_versions` row, which is what
 * search actually keys on; 0037 exists because that last one was missed once and
 * seven live vendors went missing from the homepage. And `owner_user_id` is NOT
 * NULL, so somebody has to own it.
 *
 * All of that belongs in one transaction, which is what a function gives.
 *
 * ## Live is not verified
 *
 * `publish` sets the business active and the listing approved. It deliberately
 * leaves `verification_status = 'unverified'`. "Live" means we are showing this
 * business; "Verified" means somebody checked its registration documents, and it
 * renders as a badge next to the name. An admin creating a listing from a phone
 * call has done the first and not the second, and a badge that means "an admin
 * was in a hurry" devalues it everywhere else it appears.
 */
export async function createVendorAsAdmin(actor: Actor, input: AdminCreateVendorInput) {
  // `admin_create_vendor` re-checks this itself, which is the check that counts
  // — it is SECURITY DEFINER and reachable over PostgREST by any authenticated
  // caller. This one exists so the refusal is a sentence rather than a 42501.
  assertPermission(actor, 'vendor.verify')

  const supabase = await createClient()

  /*
   * `admin_create_vendor` arrives with migration 0039 and enters the generated
   * types on the next `npm run db:types`. Until then the `rpc()` overload does
   * not know the name, and `src/types/database.ts` is generated — hand-editing
   * it is forbidden (CLAUDE.md invariant 4).
   *
   * The cast is on the **client**, not on the method. Writing
   * `const rpc = supabase.rpc as …` reads as the tidier version of this and is
   * broken: it detaches the function from its receiver, and supabase-js's `rpc`
   * reads `this.rest`. That shipped once and every delete died with "Cannot read
   * properties of undefined (reading 'rest')" — a TypeError, so it never reached
   * the error mapper and surfaced as a generic internal error.
   *
   * Delete the cast once the types have been refreshed; the call is already
   * right.
   */
  const client = supabase as unknown as {
    rpc: (
      name: 'admin_create_vendor',
      args: Record<string, unknown>,
    ) => Promise<{
      data: { vendorId?: string; slug?: string; status?: string; ownerIsCreator?: boolean } | null
      error: { code?: string | null; message?: string | null } | null
    }>
  }

  const { data, error } = await client.rpc('admin_create_vendor', {
    p_display_name: input.displayName,
    p_slug: input.slug,
    p_primary_category: input.primaryCategoryId,
    p_primary_city: input.primaryCityId,
    p_about: input.about?.trim() || null,
    p_email: input.email || null,
    p_phone: input.phone || null,
    p_website: input.website || null,
    p_owner_email: input.ownerEmail || null,
    p_publish: input.publish,
  })

  if (error) {
    const failure = describeCreateVendorError(error, 'We could not create that business.')
    throw new ServiceError(
      failure.code,
      failure.message,
      failure.field ? { [failure.field]: [failure.message] } : undefined,
    )
  }

  /*
   * A `jsonb`-returning function that raised nothing should always give a row
   * back. If it somehow did not, the id is what every caller needs — reporting
   * success without one would send the admin to `/admin/vendors/undefined`.
   */
  if (!data?.vendorId) {
    throw new ServiceError(
      'internal_error',
      'The business may have been created, but we could not confirm it. Check the vendor list.',
    )
  }

  /*
   * The function writes its own `vendor.admin_created` audit row, inside the
   * same transaction as the inserts — so a create that succeeds is always
   * logged and one that rolls back never is. Nothing is written here, because a
   * second entry from the application would give one event two names.
   */
  return {
    vendorId: data.vendorId,
    slug: data.slug ?? input.slug,
    status: data.status ?? (input.publish ? 'active' : 'draft'),
    ownerIsCreator: data.ownerIsCreator ?? !input.ownerEmail,
  }
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
