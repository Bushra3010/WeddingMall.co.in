'use server'

import { revalidatePath } from 'next/cache'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { assertPermission, can, assertVendorCapability } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { getActor } from '@/server/dal/actor'
import { attributeDefinitionSchema, linesToList } from '@/features/listings/schema'
import type { Json } from '@/types/database'
import { describeDeleteError } from '@/features/admin/delete-errors'

/**
 * Category attributes (PRD 6.2 — "Category-specific filters must be
 * data-driven through attribute definitions").
 *
 * Definitions are admin-managed; values are vendor-managed. Both go through
 * here so the two halves stay consistent.
 */

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function saveAttributeAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction('taxonomy.saveAttribute', async () => {
    const actor = await getActor()
    if (!can(actor, 'admin.manage') && !can(actor, 'cms.publish')) {
      assertPermission(actor, 'admin.manage')
    }

    const input = attributeDefinitionSchema.parse({
      id: str(form, 'id') || undefined,
      categoryId: str(form, 'categoryId'),
      code: str(form, 'code'),
      label: str(form, 'label'),
      inputType: str(form, 'inputType'),
      dataType: str(form, 'dataType'),
      unit: str(form, 'unit'),
      filterable: form.get('filterable') === 'on',
      required: form.get('required') === 'on',
      options: linesToList(str(form, 'options'), 60),
      sortOrder: str(form, 'sortOrder') || 0,
    })

    // A choice-based attribute without options produces a filter nobody can use.
    if (
      (input.inputType === 'select' || input.inputType === 'multiselect') &&
      input.options.length === 0
    ) {
      throw new ServiceError('validation_error', 'A select attribute needs at least one option.')
    }

    const supabase = await createClient()
    const row = {
      category_id: input.categoryId,
      code: input.code,
      label: input.label,
      input_type: input.inputType,
      data_type: input.dataType,
      unit: input.unit || null,
      filterable: input.filterable,
      required: input.required,
      options_json: input.options,
      sort_order: input.sortOrder,
    }

    if (input.id) {
      const { error } = await supabase.from('category_attributes').update(row).eq('id', input.id)
      if (error) {
        throw new ServiceError(
          error.code === '23505' ? 'conflict' : 'internal_error',
          error.code === '23505'
            ? 'That code is already used in this category.'
            : 'We could not save that attribute.',
        )
      }
      return { id: input.id }
    }

    const { data, error } = await supabase
      .from('category_attributes')
      .insert(row)
      .select('id')
      .single()
    if (error || !data) {
      throw new ServiceError(
        error?.code === '23505' ? 'conflict' : 'internal_error',
        error?.code === '23505'
          ? 'That code is already used in this category.'
          : 'We could not create that attribute.',
      )
    }
    return { id: data.id }
  })

  if (result.ok) {
    revalidatePath('/admin/attributes')
    revalidatePath('/vendors')
  }
  return result
}

/**
 * Delete an attribute definition (PRD 6.2).
 *
 * Unlike the other deletes this one proceeds rather than refusing, and returns
 * how many vendor answers went with it. A question that no longer exists cannot
 * have meaningful answers, and there is no way to hide an attribute — refusing
 * while any vendor had filled it in would make it permanently undeletable. The
 * admin screen shows that count next to the button, so the consequence is known
 * before the click rather than discovered after it.
 */
export async function deleteAttributeAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string; answersRemoved: number }>> {
  const result = await runAction('taxonomy.deleteAttribute', async () => {
    // The same gate `saveAttributeAction` uses. Whoever may create an
    // attribute may remove one; splitting them would leave a role able to add
    // rows it could never clean up.
    const actor = await getActor()
    if (!can(actor, 'admin.manage') && !can(actor, 'cms.publish')) {
      assertPermission(actor, 'admin.manage')
    }

    const id = str(form, 'id')
    if (!id) throw new ServiceError('validation_error', 'Missing attribute.')

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('delete_attribute', { p_id: id })
    if (error) {
      const failure = describeDeleteError(error, 'We could not delete that attribute.')
      throw new ServiceError(failure.code, failure.message)
    }
    // The type generator emits `Returns: unknown` for every function, so the
    // shape is narrowed here rather than asserted (ADR-010).
    return { id, answersRemoved: typeof data === 'number' ? data : 0 }
  })

  if (result.ok) {
    revalidatePath('/admin/attributes')
    revalidatePath('/vendors')
  }
  return result
}

/**
 * Saves a vendor's answers. Values are stored as jsonb whose shape follows the
 * attribute's data type, because `search_vendors` matches on that shape.
 */
export async function saveAttributeValuesAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ saved: number }>> {
  const result = await runAction('vendor.saveAttributeValues', async () => {
    const actor = await getActor()
    const vendorId = str(form, 'vendorId')
    assertVendorCapability(actor, vendorId, 'listing.edit')

    const supabase = await createClient()
    const { data: definitions, error } = await supabase
      .from('category_attributes')
      .select('id, code, data_type, input_type')
    if (error) throw new ServiceError('internal_error', 'We could not load the questions.')

    const rows: { vendor_id: string; category_attribute_id: string; value_json: Json }[] = []
    const clear: string[] = []

    for (const definition of definitions ?? []) {
      const field = `attr__${definition.id}`
      if (definition.input_type === 'multiselect') {
        const values = form
          .getAll(field)
          .filter((v): v is string => typeof v === 'string' && v !== '')
        if (values.length === 0) {
          clear.push(definition.id)
          continue
        }
        rows.push({ vendor_id: vendorId, category_attribute_id: definition.id, value_json: values })
        continue
      }

      // A checkbox that is present in the form but unchecked is a real "false",
      // not an absent answer — so booleans are only cleared when the field is
      // missing from the submission entirely.
      if (definition.data_type === 'boolean') {
        if (!form.has(field) && !form.has(`${field}__present`)) continue
        rows.push({
          vendor_id: vendorId,
          category_attribute_id: definition.id,
          value_json: form.get(field) === 'on',
        })
        continue
      }

      if (!form.has(field)) continue
      const raw = str(form, field)
      if (raw === '') {
        clear.push(definition.id)
        continue
      }

      rows.push({
        vendor_id: vendorId,
        category_attribute_id: definition.id,
        value_json: definition.data_type === 'number' ? Number(raw) : raw,
      })
    }

    if (clear.length > 0) {
      await supabase
        .from('vendor_attribute_values')
        .delete()
        .eq('vendor_id', vendorId)
        .in('category_attribute_id', clear)
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('vendor_attribute_values')
        .upsert(rows, { onConflict: 'vendor_id,category_attribute_id' })
      if (upsertError) {
        throw new ServiceError('internal_error', 'We could not save your answers.')
      }
    }

    return { saved: rows.length }
  })

  if (result.ok) revalidatePath('/vendor-dashboard/services')
  return result
}
