'use server'

import { revalidatePath } from 'next/cache'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { assertPermission, can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { getActor } from '@/server/dal/actor'
import { categoryFormSchema, cityFormSchema } from '@/features/vendors/schema'

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
