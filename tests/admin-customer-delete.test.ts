import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Guards on deleting a customer account.
 *
 * This is the most destructive action in the admin panel: it removes the
 * person's sign-in, not just a row, and there is no undo. It is also the one
 * place where RLS *cannot* be the boundary — the account is a row in
 * `auth.users`, which no policy covers — so these checks in
 * `deleteCustomerAsAdmin` are the entire boundary, and every one of them is
 * asserted here.
 *
 * The ordering assertions matter as much as the refusals: each test checks that
 * `deleteAuthUser` was never reached, because a guard that refuses *after* the
 * account is gone is not a guard.
 */

const deleteAuthUser = vi.fn(async () => ({ error: null as string | null }))
const getAccountBlockers = vi.fn(async (): Promise<string[]> => [])
const hasAdminAccess = vi.fn(async () => false)
const auditWrite = vi.fn(async () => {})

vi.mock('@/server/jobs/delete-customer', () => ({
  deleteAuthUser: (...a: unknown[]) => deleteAuthUser(...(a as [])),
  getAccountBlockers: (...a: unknown[]) => getAccountBlockers(...(a as [])),
  hasAdminAccess: (...a: unknown[]) => hasAdminAccess(...(a as [])),
}))
vi.mock('@/lib/security/audit', () => ({ audit: (...a: unknown[]) => auditWrite(...(a as [])) }))

const { deleteCustomerAsAdmin } = await import('@/server/services/admin-customers')

const superAdmin = { userId: 'admin-1', adminRoles: ['super_admin'] as const, vendorRoles: {} }

beforeEach(() => {
  deleteAuthUser.mockClear()
  auditWrite.mockClear()
  getAccountBlockers.mockClear().mockResolvedValue([])
  hasAdminAccess.mockClear().mockResolvedValue(false)
})

describe('deleteCustomerAsAdmin', () => {
  it('deletes an account that never did anything', async () => {
    await expect(deleteCustomerAsAdmin(superAdmin, 'cust-1')).resolves.toEqual({ id: 'cust-1' })
    expect(deleteAuthUser).toHaveBeenCalledWith('cust-1')
  })

  it('writes the audit entry before the account is gone, not after', async () => {
    // An unlogged deletion is unrecoverable; a logged attempt that did not
    // happen is not. So the order is load-bearing.
    const order: string[] = []
    auditWrite.mockImplementationOnce(async () => void order.push('audit'))
    deleteAuthUser.mockImplementationOnce(async () => {
      order.push('delete')
      return { error: null }
    })

    await deleteCustomerAsAdmin(superAdmin, 'cust-1')
    expect(order).toEqual(['audit', 'delete'])
  })

  it('refuses a support agent, who may browse accounts but not remove them', async () => {
    const support = { userId: 'sup-1', adminRoles: ['support_agent'] as const, vendorRoles: {} }

    await expect(deleteCustomerAsAdmin(support, 'cust-1')).rejects.toMatchObject({
      code: 'forbidden',
    })
    expect(deleteAuthUser).not.toHaveBeenCalled()
  })

  it('refuses to delete the account you are signed in as', async () => {
    await expect(deleteCustomerAsAdmin(superAdmin, 'admin-1')).rejects.toMatchObject({
      code: 'conflict',
      message: expect.stringMatching(/your own account/i),
    })
    expect(deleteAuthUser).not.toHaveBeenCalled()
  })

  it('refuses an account that still holds admin access', async () => {
    hasAdminAccess.mockResolvedValueOnce(true)

    await expect(deleteCustomerAsAdmin(superAdmin, 'other-admin')).rejects.toMatchObject({
      code: 'conflict',
      message: expect.stringMatching(/administrator access/i),
    })
    expect(deleteAuthUser).not.toHaveBeenCalled()
  })

  it('names what is attached rather than reporting a constraint', async () => {
    getAccountBlockers.mockResolvedValueOnce(['3 enquiries', '1 review'])

    await expect(deleteCustomerAsAdmin(superAdmin, 'cust-1')).rejects.toMatchObject({
      code: 'conflict',
      message: expect.stringContaining('3 enquiries, 1 review'),
    })
    expect(deleteAuthUser).not.toHaveBeenCalled()
  })

  it('treats a failed delete as a race, not as success', async () => {
    // Something attached itself between the count and the delete. The database
    // refused, so nothing was removed — saying "deleted" here would be a lie.
    deleteAuthUser.mockResolvedValueOnce({ error: 'update or delete violates foreign key' })

    await expect(deleteCustomerAsAdmin(superAdmin, 'cust-1')).rejects.toMatchObject({
      code: 'conflict',
    })
  })

  it('does not leak the provider error to the screen', async () => {
    deleteAuthUser.mockResolvedValueOnce({
      error: 'violates foreign key constraint "enquiries_customer_id_fkey" on table "enquiries"',
    })

    await expect(deleteCustomerAsAdmin(superAdmin, 'cust-1')).rejects.not.toMatchObject({
      message: expect.stringMatching(/fkey|constraint/i),
    })
  })
})
