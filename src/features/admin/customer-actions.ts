'use server'

import { revalidatePath } from 'next/cache'

import { runAction, type ActionResult } from '@/lib/action-result'
import { getActor } from '@/server/dal/actor'
import { deleteCustomerAsAdmin } from '@/server/services/admin-customers'

/** Customer account management (PRD 6.11, 14.3). */
export async function deleteCustomerAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction('admin.deleteCustomer', async () => {
    const actor = await getActor()
    const id = form.get('id')
    return deleteCustomerAsAdmin(actor, typeof id === 'string' ? id.trim() : '')
  })

  if (result.ok) revalidatePath('/admin/customers')
  return result
}
