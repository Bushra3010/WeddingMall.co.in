'use server'

import { revalidatePath } from 'next/cache'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { assertPermission, can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { getActor } from '@/server/dal/actor'
import { categoryFormSchema, cityFormSchema } from '@/features/vendors/schema'
import { describeDeleteCityError } from '@/features/taxonomy/delete-errors'

/**
 * Taxonomy management (PRD 6.11).
 *
 * Writes are gated on `admin.manage` or `cms.publish` — the same pair the
 * `can_manage_taxonomy()` policy uses. Renaming is allowed: a trigger added in
 * migration 0012 records the old → new mapping, and the public routes redirect
 * on the miss path, so an indexed URL never breaks.
 */

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function assertTaxonomyPermission() {
  const actor = await getActor()
  if (!can(actor, 'admin.manage') && !can(actor, 'cms.publish')) {
    assertPermission(actor, 'admin.manage')
  }
  return actor
}

export async function saveCategoryAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction('taxonomy.saveCategory', async () => {
    await assertTaxonomyPermission()

    const input = categoryFormSchema.parse({
      id: str(form, 'id') || undefined,
      name: str(form, 'name'),
      slug: str(form, 'slug'),
      description: str(form, 'description'),
      parentId: str(form, 'parentId'),
      sortOrder: str(form, 'sortOrder') || 0,
      active: form.get('active') === 'on',
    })

    const supabase = await createClient()
    const row = {
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      parent_id: input.parentId || null,
      sort_order: input.sortOrder,
      active: input.active,
    }

    if (input.id) {
      const { error } = await supabase.from('categories').update(row).eq('id', input.id)
      if (error) {
        throw new ServiceError(
          error.code === '23505' ? 'conflict' : 'internal_error',
          error.code === '23505'
            ? 'That slug is already in use.'
            : 'We could not save that category.',
        )
      }
      return { id: input.id }
    }

    const { data, error } = await supabase.from('categories').insert(row).select('id').single()
    if (error || !data) {
      throw new ServiceError(
        error?.code === '23505' ? 'conflict' : 'internal_error',
        error?.code === '23505'
          ? 'That slug is already in use.'
          : 'We could not create that category.',
      )
    }
    return { id: data.id }
  })

  if (result.ok) {
    revalidatePath('/admin/categories')
    revalidatePath('/categories')
    revalidatePath('/')
  }
  return result
}

export async function saveCityAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction('taxonomy.saveCity', async () => {
    await assertTaxonomyPermission()

    const input = cityFormSchema.parse({
      id: str(form, 'id') || undefined,
      stateId: str(form, 'stateId'),
      name: str(form, 'name'),
      slug: str(form, 'slug'),
      sortOrder: str(form, 'sortOrder') || 0,
      active: form.get('active') === 'on',
    })

    const supabase = await createClient()
    const row = {
      state_id: input.stateId,
      name: input.name,
      slug: input.slug,
      sort_order: input.sortOrder,
      active: input.active,
    }

    if (input.id) {
      const { error } = await supabase.from('cities').update(row).eq('id', input.id)
      if (error) {
        throw new ServiceError(
          error.code === '23505' ? 'conflict' : 'internal_error',
          error.code === '23505' ? 'That slug is already in use.' : 'We could not save that city.',
        )
      }
      return { id: input.id }
    }

    const { data, error } = await supabase.from('cities').insert(row).select('id').single()
    if (error || !data) {
      throw new ServiceError(
        error?.code === '23505' ? 'conflict' : 'internal_error',
        error?.code === '23505' ? 'That slug is already in use.' : 'We could not create that city.',
      )
    }
    return { id: data.id }
  })

  if (result.ok) {
    revalidatePath('/admin/locations')
    revalidatePath('/cities')
    revalidatePath('/')
  }
  return result
}

/**
 * Delete a city (PRD 6.11).
 *
 * The check lives in `delete_city()` (migration 0032), not here. Seven tables
 * reference a city and two of them used to cascade, so deleting one that is in
 * use silently removed vendors' coverage. Doing the count in TypeScript would
 * leave a window between counting and deleting; the function takes `for update`
 * on the row first, which an FK insert cannot cross.
 *
 * That means the message a refused delete shows is written in SQL. It is safe
 * to surface: it names counts and the city, never a row belonging to anyone.
 */
export async function deleteCityAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction('taxonomy.deleteCity', async () => {
    await assertTaxonomyPermission()

    const id = str(form, 'id')
    if (!id) throw new ServiceError('validation_error', 'Missing city.')

    const supabase = await createClient()
    const { error } = await supabase.rpc('delete_city', { p_id: id })

    if (error) {
      const failure = describeDeleteCityError(error)
      throw new ServiceError(failure.code, failure.message)
    }

    return { id }
  })

  if (result.ok) {
    revalidatePath('/admin/locations')
    revalidatePath('/cities')
    revalidatePath('/')
  }
  return result
}

/**
 * Show or hide a state (PRD 6.11).
 *
 * States are seeded for the whole country (migration `0026`) but start
 * inactive: a state with no cities would otherwise appear in public filters as
 * an empty destination. This is how an admin turns one on once there is
 * something in it.
 */
export async function toggleStateAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string; active: boolean }>> {
  return runAction('taxonomy.toggleState', async () => {
    await assertTaxonomyPermission()

    const id = str(form, 'id')
    const active = form.get('active') === 'true'
    if (!id) throw new ServiceError('validation_error', 'Missing state.')

    const supabase = await createClient()

    /*
     * Hiding a state hides its cities from public filters by implication, so
     * the admin is told how many that is rather than discovering it from a
     * support ticket. The cities themselves are left alone — deactivating a
     * state is reversible and must not quietly rewrite rows underneath it.
     */
    const { count } = await supabase
      .from('cities')
      .select('id', { count: 'exact', head: true })
      .eq('state_id', id)
      .eq('active', true)

    // Checked BEFORE the write. Updating first and then throwing would apply
    // the change and report failure — the worst of both, and the user would
    // have no reason to reload and discover it had actually happened.
    if (!active && (count ?? 0) > 0) {
      throw new ServiceError(
        'conflict',
        `That state still has ${count} active ${count === 1 ? 'city' : 'cities'}. Hide those first.`,
      )
    }

    const { error } = await supabase.from('states').update({ active }).eq('id', id)
    if (error) throw new ServiceError('internal_error', 'We could not update that state.')

    revalidatePath('/admin/locations')
    return { id, active }
  })
}
