import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/observability/logger'

/** A vendor's own answers. Uses the session client, so RLS scopes it. */
export async function getVendorAttributeValues(vendorId: string): Promise<Record<string, unknown>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vendor_attribute_values')
      .select('category_attribute_id, value_json')
      .eq('vendor_id', vendorId)
    if (error) throw error

    return Object.fromEntries(
      (data ?? []).map((row) => [row.category_attribute_id, row.value_json]),
    )
  } catch (error) {
    logError('dal.getVendorAttributeValues', error, { vendorId })
    return {}
  }
}
