import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `deleteVendorAsAdmin` must call `rpc` **as a method on the Supabase client**.
 *
 * This is not a stylistic point. supabase-js's `rpc` reads `this.rest`, so
 * pulling it into a local — `const rpc = supabase.rpc` — detaches it from its
 * receiver and throws `Cannot read properties of undefined (reading 'rest')`.
 * That shipped to production. Because it is a TypeError rather than a
 * PostgrestError it bypassed `describeDeleteError` entirely and reached admins
 * as "Something went wrong on our side", which named neither the cause nor
 * anything they could do.
 *
 * The stub therefore records `this`, which is the only thing that distinguishes
 * the broken version from the fixed one — every other assertion passes either
 * way.
 */

type RpcResult = { error: { code?: string | null; message?: string | null } | null }

const rpc = vi.fn(function (this: unknown): Promise<RpcResult> {
  receivers.push(this)
  return Promise.resolve({ error: null })
})

let receivers: unknown[] = []
/** Stands in for `.from('vendors').select(...).eq(...).maybeSingle()`. */
const maybeSingle = vi.fn(async () => ({ data: { display_name: 'Blinksai', slug: 'blinksai' } }))
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle }) }),
}))

const auditWrite = vi.fn(async () => {})
const client = { rpc, from }

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => client) }))
vi.mock('@/lib/security/audit', () => ({ audit: (...a: unknown[]) => auditWrite(...(a as [])) }))

const { deleteVendorAsAdmin } = await import('@/server/services/admin-vendors')

const superAdmin = { userId: 'u1', adminRoles: ['super_admin'] as const, vendorRoles: {} }

beforeEach(() => {
  receivers = []
  rpc.mockClear()
  auditWrite.mockClear()
})

describe('deleteVendorAsAdmin', () => {
  it('calls delete_vendor with the client as the receiver', async () => {
    await deleteVendorAsAdmin(superAdmin, 'v1')

    expect(rpc).toHaveBeenCalledWith('delete_vendor', { p_id: 'v1' })
    // The assertion that would have caught the outage.
    expect(receivers).toEqual([client])
    expect(receivers[0]).not.toBeUndefined()
  })

  it('turns the function being absent into something an admin can act on', async () => {
    rpc.mockImplementationOnce(function (this: unknown): Promise<RpcResult> {
      receivers.push(this)
      return Promise.resolve({
        error: { code: 'PGRST202', message: 'Could not find the function public.delete_vendor' },
      })
    })

    await expect(deleteVendorAsAdmin(superAdmin, 'v1')).rejects.toMatchObject({
      code: 'not_implemented',
      message: expect.stringMatching(/migration/i),
    })
  })

  it('surfaces the SQL refusal verbatim, since it names what is in the way', async () => {
    rpc.mockImplementationOnce(function (this: unknown): Promise<RpcResult> {
      receivers.push(this)
      return Promise.resolve({
        error: { code: 'PT409', message: 'Blinksai has customer history (3 enquiries).' },
      })
    })

    await expect(deleteVendorAsAdmin(superAdmin, 'v1')).rejects.toMatchObject({
      code: 'conflict',
      message: 'Blinksai has customer history (3 enquiries).',
    })
  })

  it('records the deletion, naming the business rather than a bare id', async () => {
    /*
     * Six businesses were removed from production before anyone noticed this
     * was missing. `admin_decide_vendor()` audits approve, reject and suspend
     * itself; delete went through a different path and wrote nothing, so the
     * only irreversible decision was the one with no record of who made it.
     */
    await deleteVendorAsAdmin(superAdmin, 'v1')

    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'vendor.delete',
        entityId: 'v1',
        actorUserId: 'u1',
        before: expect.objectContaining({ display_name: 'Blinksai' }),
      }),
    )
  })

  it('does not record a deletion that was refused', async () => {
    rpc.mockImplementationOnce(function (this: unknown): Promise<RpcResult> {
      receivers.push(this)
      return Promise.resolve({ error: { code: 'PT409', message: 'has customer history' } })
    })

    await expect(deleteVendorAsAdmin(superAdmin, 'v1')).rejects.toMatchObject({ code: 'conflict' })
    expect(auditWrite).not.toHaveBeenCalled()
  })

  it('refuses an admin without admin.manage before touching the database', async () => {
    const verifier = { userId: 'u2', adminRoles: ['vendor_verifier'] as const, vendorRoles: {} }

    await expect(deleteVendorAsAdmin(verifier, 'v1')).rejects.toMatchObject({ code: 'forbidden' })
    expect(rpc).not.toHaveBeenCalled()
  })
})
