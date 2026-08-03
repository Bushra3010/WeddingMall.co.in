'use server'

import { revalidatePath } from 'next/cache'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { assertPermission } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { getActor } from '@/server/dal/actor'
import { describeDeleteError } from '@/features/admin/delete-errors'
import { planFormSchema } from '@/features/billing/plan-schema'
import type { Json } from '@/types/database'

/**
 * Plan administration (PRD 6.10).
 *
 * Gated on `billing.manage`, matching the page itself. Entitlements are written
 * as a whole object rather than merged: a partial write would leave a plan with
 * keys from two different edits, and `vendor_may_be_featured()` reads it in SQL
 * where a missing key is indistinguishable from a false one.
 */

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function savePlanAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction('billing.savePlan', async () => {
    const actor = await getActor()
    assertPermission(actor, 'billing.manage')

    const input = planFormSchema.parse({
      id: str(form, 'id') || undefined,
      code: str(form, 'code'),
      name: str(form, 'name'),
      billingInterval: str(form, 'billingInterval'),
      amountMinor: str(form, 'amount'),
      currency: str(form, 'currency') || 'INR',
      trialDays: str(form, 'trialDays') || 0,
      sortOrder: str(form, 'sortOrder') || 0,
      active: form.get('active') === 'on',
      entitlements: {
        listings: str(form, 'listings'),
        categories: str(form, 'categories'),
        media: str(form, 'media'),
        teamSize: str(form, 'teamSize'),
        leadQuota: str(form, 'leadQuota'),
        analytics: form.get('analytics') === 'on',
        featured: form.get('featured') === 'on',
        export: form.get('export') === 'on',
      },
    })

    const supabase = await createClient()
    const row = {
      code: input.code,
      name: input.name,
      billing_interval: input.billingInterval,
      amount_minor: input.amountMinor,
      currency: input.currency,
      trial_days: input.trialDays,
      sort_order: input.sortOrder,
      active: input.active,
      entitlements_json: input.entitlements as unknown as Json,
    }

    if (input.id) {
      const { error } = await supabase.from('plans').update(row).eq('id', input.id)
      if (error) {
        throw new ServiceError(
          error.code === '23505' ? 'conflict' : 'internal_error',
          error.code === '23505' ? 'That code is already in use.' : 'We could not save that plan.',
        )
      }
      return { id: input.id }
    }

    const { data, error } = await supabase.from('plans').insert(row).select('id').single()
    if (error || !data) {
      throw new ServiceError(
        error?.code === '23505' ? 'conflict' : 'internal_error',
        error?.code === '23505' ? 'That code is already in use.' : 'We could not create that plan.',
      )
    }
    return { id: data.id }
  })

  if (result.ok) {
    revalidatePath('/admin/plans')
    revalidatePath('/pricing')
  }
  return result
}

/**
 * Delete a plan.
 *
 * `delete_plan()` (migration 0034) refuses while any subscription or vendor
 * points at it — including cancelled subscriptions, because a deleted plan
 * leaves past billing rows referring to nothing. Deactivating is the reversible
 * option and the refusal says so.
 */
export async function deletePlanAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction('billing.deletePlan', async () => {
    const actor = await getActor()
    assertPermission(actor, 'billing.manage')

    const id = str(form, 'id')
    if (!id) throw new ServiceError('validation_error', 'Missing plan.')

    const supabase = await createClient()
    const { error } = await supabase.rpc('delete_plan', { p_id: id })
    if (error) {
      const failure = describeDeleteError(error, 'We could not delete that plan.')
      throw new ServiceError(failure.code, failure.message)
    }
    return { id }
  })

  if (result.ok) {
    revalidatePath('/admin/plans')
    revalidatePath('/pricing')
  }
  return result
}
