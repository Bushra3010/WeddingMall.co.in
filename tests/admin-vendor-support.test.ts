import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Actor } from '@/lib/permissions'
import {
  ADMIN_DOCUMENT_KINDS,
  CANCELLED_CHEQUE,
  adminUploadDocumentSchema,
} from '@/features/admin/vendor-documents'
import { DOCUMENT_KINDS } from '@/features/vendors/schema'

/**
 * An admin filing paperwork on a business's behalf (migration 0040).
 *
 * Two questions, and they have different answers: who may add a verification
 * document, and who may change where the money goes. The policies in 0040 say
 * `vendor.verify` for the first and `billing.manage` for the second, and these
 * services have to say exactly the same thing — a guard that is merely *close*
 * to its policy produces a 42501 with no sentence attached, which is the
 * failure CLAUDE.md invariant 2 exists to prevent.
 *
 * The audit assertions matter as much as the permission ones. An admin write to
 * `vendor_bank_accounts` is recorded, and what gets recorded must be the masked
 * number: `audit_logs` is long-lived and readable by anyone with `admin.manage`,
 * so writing the digits there would put a copy of the account number outside the
 * table whose whole point is that reading it is an audited, permission-checked
 * act.
 */

/*
 * A real v4 UUID, not `1111-1111-…`. Zod 4's `z.uuid()` checks the version and
 * variant nibbles rather than just the shape, so the usual all-ones placeholder
 * is rejected — and would have failed this schema for the wrong reason.
 * `gen_random_uuid()` emits v4, which is what every id in this database is.
 */
const VENDOR = '11111111-1111-4111-8111-111111111111'

// The parameters are declared, unused, so `mock.calls[n]` is a typed tuple
// rather than `[]` — the payload assertions below read from it.
const upsert = vi.fn(async (_values: Record<string, unknown>, _options?: unknown) => ({
  error: null,
}))
const deleteEq = vi.fn(async () => ({ error: null, count: 1 }))
const maybeSingle = vi.fn(async () => ({
  data: {
    storage_path: `${VENDOR}/doc.pdf`,
    document_type: 'gst',
    vendor_verifications: { vendor_id: VENDOR },
  },
}))

const from = vi.fn(() => ({
  upsert,
  select: () => ({ eq: () => ({ maybeSingle }) }),
  delete: () => ({ eq: deleteEq }),
}))

const storageRemove = vi.fn(async () => ({ data: null, error: null }))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ from })) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ storage: { from: () => ({ remove: storageRemove }) } }),
}))

type AuditEntry = {
  action: string
  entityType: string
  entityId: string
  actorUserId: string | null
  before?: unknown
  after?: unknown
}

const auditWrite = vi.fn(async (_entry: AuditEntry) => {})
vi.mock('@/lib/security/audit', () => ({
  audit: (entry: unknown) => auditWrite(entry as AuditEntry),
}))

/** The row as it stands *before* a write, which is what the audit entry needs. */
const readBankAccountRow = vi.fn(async () => ({
  vendor_id: VENDOR,
  account_holder_name: 'Krishna Vatika',
  account_number: '50100123456789',
  ifsc: 'HDFC0001234',
}))

vi.mock('@/server/dal/vendor-bank', () => ({
  isMissingBankTable: () => false,
  readBankAccountRow: (...a: unknown[]) => readBankAccountRow(...(a as [])),
}))

const { deleteBankAccount, saveBankAccount } = await import('@/server/services/vendor-bank')
const { deleteVerificationDocument } = await import('@/server/services/verification')

function actor(overrides: Partial<Actor> = {}): Actor {
  return { userId: 'u1', adminRoles: [], vendorRoles: {}, ...overrides }
}

const owner = actor({ vendorRoles: { [VENDOR]: 'vendor_owner' } })
const manager = actor({ vendorRoles: { [VENDOR]: 'vendor_manager' } })
const financeAdmin = actor({ adminRoles: ['finance_admin'] })
const verifier = actor({ adminRoles: ['vendor_verifier'] })
const support = actor({ adminRoles: ['support_agent'] })

const details = {
  accountHolderName: 'Krishna Vatika',
  accountNumber: '50100987654321',
  confirmAccountNumber: '50100987654321',
  ifsc: 'HDFC0001234',
  bankName: '',
  branchName: '',
  accountType: 'savings' as const,
  upiId: '',
}

beforeEach(() => {
  upsert.mockClear()
  deleteEq.mockClear()
  deleteEq.mockImplementation(async () => ({ error: null, count: 1 }))
  auditWrite.mockClear()
  storageRemove.mockClear()
  readBankAccountRow.mockClear()
})

describe('the document types an admin may file', () => {
  it('offers everything the vendor can, plus the cancelled cheque', () => {
    const values = ADMIN_DOCUMENT_KINDS.map((kind) => kind.value)
    for (const kind of DOCUMENT_KINDS) expect(values).toContain(kind.value)
    expect(values).toContain(CANCELLED_CHEQUE)
  })

  /*
   * `cancelled_cheque` is the type the payout account points at, and the admin
   * upload path attaches it on the strength of this string. A rename on one
   * side and not the other would upload the file, silently skip the attach, and
   * report success.
   */
  it('accepts a cancelled cheque and refuses an invented type', () => {
    expect(
      adminUploadDocumentSchema.safeParse({ vendorId: VENDOR, documentType: CANCELLED_CHEQUE })
        .success,
    ).toBe(true)
    expect(
      adminUploadDocumentSchema.safeParse({ vendorId: VENDOR, documentType: 'passport' }).success,
    ).toBe(false)
    expect(
      adminUploadDocumentSchema.safeParse({ vendorId: 'not-a-uuid', documentType: 'gst' }).success,
    ).toBe(false)
  })
})

describe('payout details: who may write them', () => {
  it('lets the business owner save their own', async () => {
    await expect(saveBankAccount(owner, VENDOR, details)).resolves.toEqual({ vendorId: VENDOR })
  })

  it('lets a finance admin save them on the business behalf', async () => {
    await expect(saveBankAccount(financeAdmin, VENDOR, details)).resolves.toEqual({
      vendorId: VENDOR,
    })
  })

  /*
   * The one that is easy to get wrong. A verifier *reads* the account — that is
   * what checking a cancelled cheque against a name requires, and 0038's read
   * policy admits them. Reading it is not a reason to be able to redirect it.
   */
  it('refuses a vendor verifier, who may only read', async () => {
    await expect(saveBankAccount(verifier, VENDOR, details)).rejects.toMatchObject({
      code: 'forbidden',
    })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('refuses a vendor manager, who is not the owner', async () => {
    await expect(saveBankAccount(manager, VENDOR, details)).rejects.toMatchObject({
      code: 'forbidden',
    })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('refuses a support agent', async () => {
    await expect(saveBankAccount(support, VENDOR, details)).rejects.toMatchObject({
      code: 'forbidden',
    })
  })

  it('never sends verified_at, whoever is writing', async () => {
    await saveBankAccount(financeAdmin, VENDOR, details)
    const [payload] = upsert.mock.calls[0]
    expect(payload).not.toHaveProperty('verified_at')
    expect(payload).not.toHaveProperty('verified_by')
  })
})

describe('payout details: what an admin write records', () => {
  it('audits the change with the number masked, never the digits', async () => {
    await saveBankAccount(financeAdmin, VENDOR, details)

    expect(auditWrite).toHaveBeenCalledTimes(1)
    const [entry] = auditWrite.mock.calls[0]
    expect(entry).toMatchObject({
      action: 'vendor.payout',
      entityType: 'vendor',
      entityId: VENDOR,
      actorUserId: 'u1',
    })

    const serialised = JSON.stringify(entry)
    expect(serialised).not.toContain(details.accountNumber)
    expect(serialised).not.toContain('50100123456789')
    expect(serialised).toContain('4321')
  })

  it('records the removal, with what was there before', async () => {
    await deleteBankAccount(financeAdmin, VENDOR)

    const [entry] = auditWrite.mock.calls[0]
    expect(entry.before).toMatchObject({ onFile: true, ifsc: 'HDFC0001234' })
    expect(entry.after).toEqual({ onFile: false })
    expect(JSON.stringify(entry)).not.toContain('50100123456789')
  })

  /*
   * A business editing its own record is not an event anyone investigates, and
   * the read that builds the `before` half costs a query. Both are skipped.
   */
  it('does not audit, or re-read, a vendor saving their own', async () => {
    await saveBankAccount(owner, VENDOR, details)
    expect(auditWrite).not.toHaveBeenCalled()
    expect(readBankAccountRow).not.toHaveBeenCalled()
  })
})

describe('verification documents: who may remove one', () => {
  it('lets a vendor verifier remove one', async () => {
    await expect(deleteVerificationDocument(verifier, 'doc-1')).resolves.toEqual({ ok: true })
    expect(storageRemove).toHaveBeenCalledWith([`${VENDOR}/doc.pdf`])
  })

  it("lets the business's own team remove one", async () => {
    await expect(deleteVerificationDocument(manager, 'doc-1')).resolves.toEqual({ ok: true })
  })

  it('refuses a support agent, who holds vendor.read and not vendor.verify', async () => {
    await expect(deleteVerificationDocument(support, 'doc-1')).rejects.toMatchObject({
      code: 'forbidden',
    })
    expect(storageRemove).not.toHaveBeenCalled()
  })

  /*
   * The regression this replaced. A DELETE that RLS filters out returns success
   * with zero rows — and the object underneath is removed with the service-role
   * client, which bypasses RLS. Reporting success there would take the file away
   * and leave the row pointing at nothing.
   */
  it('refuses, and keeps the file, when the delete matched no row', async () => {
    deleteEq.mockImplementationOnce(async () => ({ error: null, count: 0 }))

    await expect(deleteVerificationDocument(verifier, 'doc-1')).rejects.toMatchObject({
      code: 'forbidden',
    })
    expect(storageRemove).not.toHaveBeenCalled()
  })

  it('audits an admin removal but not the vendor own', async () => {
    await deleteVerificationDocument(verifier, 'doc-1')
    expect(auditWrite).toHaveBeenCalledTimes(1)
    expect(auditWrite.mock.calls[0][0]).toMatchObject({
      action: 'vendor.document',
      entityId: VENDOR,
      after: { removed: 'gst' },
    })

    auditWrite.mockClear()
    await deleteVerificationDocument(manager, 'doc-1')
    expect(auditWrite).not.toHaveBeenCalled()
  })
})
