'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { deleteAdminVendorAction } from '@/features/admin/vendor-actions'

/**
 * Deleting a business, at the foot of the decision card.
 *
 * Below the outcomes rather than among them. The four decisions above go
 * through `admin_decide_vendor()`, are reversible, and leave an audit entry;
 * this does none of that, so it does not share their radio group or their
 * submit button — a mis-click on a fifth radio would be one press from
 * permanent.
 *
 * `redirectTo=detail` sends the action to the list afterwards — staying here
 * would re-render a page whose subject no longer exists and 404 the admin who
 * just used the button.
 *
 * The confirmation is inline rather than `window.confirm` for the reason the
 * other admin deletes give: `delete_vendor()` refuses when customer history is
 * attached and names what is in the way, and a browser dialogue can ask the
 * question but cannot show the answer.
 *
 * Renders no card of its own — `DecisionForm` supplies it.
 */
export function VendorDeletePanel({
  vendorId,
  displayName,
}: {
  vendorId: string
  displayName: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [state, action] = useAction(deleteAdminVendorAction)

  return (
    <section className="border-sand-200 mt-5 border-t pt-5">
      <h3 className="text-sand-800 text-sm font-medium">Delete this business</h3>
      <p className="text-sand-600 mt-1 text-sm">
        Only a business with no enquiries, payments, reviews, or subscriptions can be deleted.
        Suspend the rest — that hides them without losing the record.
      </p>

      <div className="mt-3">
        <FormMessage state={state} />
      </div>

      {confirming ? (
        <div className="mt-3 space-y-3">
          <p className="text-sand-700 text-sm">
            Delete {displayName}? This cannot be undone.
            <span className="block text-[var(--color-danger)]">
              Its listing, photos, packages, and team access go too.
            </span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="border-sand-300 text-sand-700 hover:bg-sand-100 rounded-full border px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <form action={action}>
              <input type="hidden" name="id" value={vendorId} />
              <input type="hidden" name="redirectTo" value="detail" />
              <ConfirmButton />
            </form>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="border-sand-300 text-sand-700 mt-3 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Delete<span className="sr-only"> {displayName}</span>
        </button>
      )}
    </section>
  )
}

function ConfirmButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="rounded-full border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_oklch,var(--color-danger)_10%,white)] disabled:opacity-50"
    >
      {pending ? 'Deleting…' : 'Delete permanently'}
    </button>
  )
}
