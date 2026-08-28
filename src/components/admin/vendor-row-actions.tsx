'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Eye, Pencil, Trash2, X } from 'lucide-react'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { deleteAdminVendorAction } from '@/features/admin/vendor-actions'
import { decideVendorAction } from '@/features/vendors/actions'

/**
 * The five things an admin needs to do to a business, on the row itself.
 *
 * All of this already existed on the detail page except Delete — the list just
 * never offered any of it, so every decision cost a page load and a scroll.
 * View and Edit stay links rather than inline forms: editing needs the full
 * city list, and shipping that to the browser once per row for a hundred rows
 * to support the one an admin actually opens is not a trade worth making.
 *
 * Approve is one click because `admin_decide_vendor()` does not require a
 * reason for it. Reject does, so it opens a field first — the same rule the
 * SQL applies, asked for at the point of the decision rather than refused
 * after it.
 */
export function VendorRowActions({
  vendorId,
  displayName,
  status,
  canVerify,
  canDelete,
}: {
  vendorId: string
  displayName: string
  status: string
  canVerify: boolean
  canDelete: boolean
}) {
  const [mode, setMode] = useState<'idle' | 'reject' | 'delete'>('idle')
  const [decideState, decideAction] = useAction(decideVendorAction)
  const [deleteState, deleteAction] = useAction(deleteAdminVendorAction)

  // Close the panel once the server has accepted it, so the row goes back to
  // showing what the database now holds. Adjusted during render — React's
  // documented way to reset state in response to a change, and the shape
  // `CityRow` already uses.
  const [lastDecide, setLastDecide] = useState(decideState)
  if (lastDecide !== decideState) {
    setLastDecide(decideState)
    if (decideState?.ok) setMode('idle')
  }

  // A suspended business is reactivated, not approved; `admin_decide_vendor()`
  // refuses the wrong verb, so the button that cannot work is not offered.
  const decidable = status !== 'suspended' && status !== 'active'

  if (mode === 'reject') {
    return (
      <form action={decideAction} className="w-full max-w-lg space-y-2 sm:w-96">
        <input type="hidden" name="vendorId" value={vendorId} />
        <input type="hidden" name="decision" value="reject" />
        <FormMessage state={decideState} />
        <label className="text-sand-800 block text-xs font-medium" htmlFor={`reason-${vendorId}`}>
          Why is {displayName} being rejected?
        </label>
        <textarea
          id={`reason-${vendorId}`}
          name="reason"
          required
          rows={3}
          maxLength={1000}
          className="border-sand-300 w-full rounded-lg border bg-white p-2 text-sm"
        />
        <p className="text-sand-500 text-xs">
          Shared with the business so they know what to fix. Recorded in the audit log.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-3 py-1 text-xs font-medium"
          >
            Cancel
          </button>
          <PendingButton tone="danger" pendingLabel="Rejecting…">
            Reject
          </PendingButton>
        </div>
      </form>
    )
  }

  if (mode === 'delete') {
    return (
      <div className="flex w-full max-w-lg flex-col items-end gap-2 sm:w-96">
        <p className="text-sand-700 text-xs">
          Delete {displayName}? This cannot be undone.
          <span className="block text-[var(--color-danger)]">
            Its listing, photos, packages, and team access go too.
          </span>
        </p>
        {/* The refusal names the enquiries or payments still attached, so it is
            shown here rather than as a toast that scrolls away. */}
        <div className="w-full text-left">
          <FormMessage state={deleteState} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-3 py-1 text-xs font-medium"
          >
            Cancel
          </button>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={vendorId} />
            <PendingButton tone="danger" pendingLabel="Deleting…">
              Delete {displayName}
            </PendingButton>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {/* A failed decision has no panel left to report into once the form
          closes, so the summary sits above the buttons. */}
      {decideState && !decideState.ok ? (
        <div className="max-w-80 text-left">
          <FormMessage state={decideState} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={`/admin/vendors/${vendorId}`} className={GHOST}>
          <Eye aria-hidden="true" className="size-3" />
          View<span className="sr-only"> {displayName}</span>
        </Link>

        <Link href={`/admin/vendors/${vendorId}#edit`} className={GHOST}>
          <Pencil aria-hidden="true" className="size-3" />
          Edit<span className="sr-only"> {displayName}</span>
        </Link>

        {canVerify && decidable ? (
          <>
            <form action={decideAction}>
              <input type="hidden" name="vendorId" value={vendorId} />
              <input type="hidden" name="decision" value="approve" />
              <PendingButton tone="success" pendingLabel="Approving…">
                <Check aria-hidden="true" className="size-3" />
                Approve<span className="sr-only"> {displayName}</span>
              </PendingButton>
            </form>

            <button type="button" onClick={() => setMode('reject')} className={GHOST}>
              <X aria-hidden="true" className="size-3" />
              Reject<span className="sr-only"> {displayName}</span>
            </button>
          </>
        ) : null}

        {canDelete ? (
          <button
            type="button"
            onClick={() => setMode('delete')}
            className={`${GHOST} hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]`}
          >
            <Trash2 aria-hidden="true" className="size-3" />
            Delete<span className="sr-only"> {displayName}</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}

const GHOST =
  'border-sand-300 text-sand-700 hover:bg-sand-100 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors'

const TONES = {
  success:
    'border-[var(--color-success)] text-[var(--color-success)] hover:bg-[color-mix(in_oklch,var(--color-success)_10%,white)]',
  danger:
    'border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[color-mix(in_oklch,var(--color-danger)_10%,white)]',
} as const

function PendingButton({
  tone,
  pendingLabel,
  children,
}: {
  tone: keyof typeof TONES
  pendingLabel: string
  children: React.ReactNode
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${TONES[tone]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}
