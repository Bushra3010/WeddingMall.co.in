'use client'

import { useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { revealBankAccountAction } from '@/features/vendors/bank-actions'

/**
 * Reveals a payout account number to an admin, once, on demand.
 *
 * The page never holds the number: `getBankAccountSummary` masks it in the DAL,
 * so the markup carries `••••••3456` and nothing else. This fetches the real
 * value through a Server Action that writes a `pii.reveal` audit row **before**
 * returning it — the same shape as `DocumentLink` opening a private document.
 *
 * That ordering is the point. An audit entry written after the value is handed
 * over records only the reveals that finished, and a page that embeds the
 * number in its HTML records none of them at all.
 */
export function BankReveal({ vendorId }: { vendorId: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<string | null>(null)

  async function reveal() {
    setPending(true)
    setError(null)
    const result = await revealBankAccountAction(vendorId)
    setPending(false)

    if (!result.ok) {
      setError(result.message)
      return
    }
    setShown(result.data.accountNumber)
  }

  if (shown) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <code className="text-sand-900 bg-sand-100 rounded px-2 py-1 font-mono text-sm">
          {shown}
        </code>
        <span className="text-sand-500 text-xs">This reveal has been recorded.</span>
      </span>
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      {error ? (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </span>
      ) : null}
      <Button variant="outline" size="sm" onClick={reveal} disabled={pending} aria-busy={pending}>
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Eye aria-hidden="true" />
        )}
        Reveal full number
      </Button>
    </span>
  )
}
