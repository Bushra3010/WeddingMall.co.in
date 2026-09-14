import 'server-only'

import { ServiceError } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

/**
 * Writing a vendor's attribute answers (PRD 6.2).
 *
 * Extracted so the vendor's own form and the admin's editor share one mapping.
 * They authorise differently — `listing.edit` on the org versus the admin
 * `listing.moderate` — so the check stays with each caller, and RLS refuses
 * anyone neither policy covers. This function assumes nothing about who is
 * calling; it is never reachable except through an action that has asserted.
 *
 * Two form conventions matter and are easy to get wrong:
 *
 * - A checkbox that is present but unchecked is a real `false`, not an absent
 *   answer, so booleans are cleared only when the field is missing from the
 *   submission entirely. `attr__<id>__present` is what marks it as submitted.
 * - A multiselect with nothing ticked clears, rather than storing `[]`, so an
 *   emptied answer disappears from the public grid instead of rendering blank.
 */
export async function writeAttributeValues(
  vendorId: string,
  form: FormData,
): Promise<{ saved: number; cleared: number }> {
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
      const values = form.getAll(field).filter((v): v is string => typeof v === 'string' && v !== '')
      if (values.length === 0) {
        if (form.has(`${field}__present`)) clear.push(definition.id)
        continue
      }
      rows.push({ vendor_id: vendorId, category_attribute_id: definition.id, value_json: values })
      continue
    }

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
    const raw = typeof form.get(field) === 'string' ? String(form.get(field)).trim() : ''
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
    const { error: deleteError } = await supabase
      .from('vendor_attribute_values')
      .delete()
      .eq('vendor_id', vendorId)
      .in('category_attribute_id', clear)
    if (deleteError) throw new ServiceError('internal_error', 'We could not clear those answers.')
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('vendor_attribute_values')
      .upsert(rows, { onConflict: 'vendor_id,category_attribute_id' })
    /*
     * RLS returns this as a plain failure, not a distinguishable code, so the
     * message names the likeliest cause: an admin whose `listing.moderate`
     * policy (`vendor_attribute_values: admin manage`, migration 0041) has not
     * been applied to this database yet.
     */
    if (upsertError) throw new ServiceError('internal_error', 'We could not save those answers.')
  }

  return { saved: rows.length, cleared: clear.length }
}
