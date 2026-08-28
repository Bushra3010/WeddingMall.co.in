import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

import { DecisionForm } from '@/components/admin/decision-form'

/*
 * Explicit, because `globals` is off in vitest.config.ts — testing-library's
 * automatic cleanup hooks into the global `afterEach` and never registers
 * without it. Left implicit, every render stacks on the last one and counting
 * anything ("four radios") silently counts the whole file.
 */
afterEach(cleanup)

/**
 * Where the delete control sits.
 *
 * Asserted rather than eyeballed because the placement was reported wrong twice
 * and the reports were about a build that did not contain the change at all. A
 * test says which of those two things is true without anyone having to deploy.
 *
 * The Server Actions are stubbed: this is about composition, not submission.
 * `useActionState` needs a function it can call, nothing more.
 */
vi.mock('@/features/vendors/actions', () => ({
  decideVendorAction: vi.fn(async () => ({ ok: true, data: {}, requestId: 'test' })),
}))
vi.mock('@/features/admin/vendor-actions', () => ({
  deleteAdminVendorAction: vi.fn(async () => ({ ok: true, data: {}, requestId: 'test' })),
}))

const { VendorDeletePanel } = await import('@/components/admin/vendor-delete-panel')

/** A live business, which is the state the screenshots were taken in. */
function renderCard(children?: React.ReactNode) {
  return render(
    <DecisionForm vendorId="v1" status="active" canVerify canSuspend>
      {children}
    </DecisionForm>,
  )
}

describe('the decision card', () => {
  it('offers the four recorded outcomes', () => {
    renderCard()
    for (const label of ['Approve and publish', 'Request changes', 'Reject', 'Suspend']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
    }
  })

  it('puts the delete control inside the card, not in a separate one', () => {
    const { container } = renderCard(<VendorDeletePanel vendorId="v1" displayName="Blinksai" />)

    const card = container.firstElementChild
    expect(card).not.toBeNull()

    // Same card as the heading, so it cannot drift into a sibling panel again.
    expect(within(card as HTMLElement).getByText('Decision')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('Delete this business')).toBeInTheDocument()
    expect(
      within(card as HTMLElement).getByRole('button', { name: /Delete Blinksai/ }),
    ).toBeInTheDocument()
  })

  it('keeps delete out of the outcome radios and off the Record decision button', () => {
    renderCard(<VendorDeletePanel vendorId="v1" displayName="Blinksai" />)

    /*
     * The safety property. Delete is irreversible and writes no audit entry;
     * the four outcomes above it are neither. A fifth radio would put it one
     * mis-click from "Record decision".
     */
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.queryByRole('radio', { name: /delete/i })).toBeNull()

    const deleteButton = screen.getByRole('button', { name: /Delete Blinksai/ })
    const record = screen.getByRole('button', { name: 'Record decision' })
    expect(deleteButton.closest('form')).not.toBe(record.closest('form'))
  })

  it('still shows delete to an admin who has no decision to make', () => {
    // `admin.manage` and `vendor.verify` are different permissions, so "cannot
    // decide" must not silently mean "cannot delete".
    render(
      <DecisionForm vendorId="v1" status="active" canVerify={false} canSuspend={false}>
        <VendorDeletePanel vendorId="v1" displayName="Blinksai" />
      </DecisionForm>,
    )

    expect(screen.getByText(/do not have permission to make a decision/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete Blinksai/ })).toBeInTheDocument()
  })
})
