'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CreditCard } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input } from '@/components/ui/field'
import { startAdvancePaymentAction } from '@/features/payments/actions'
import { MAX_ADVANCE_RUPEES, MIN_ADVANCE_RUPEES } from '@/features/payments/advance'

/**
 * Optional advance on a booking (migration 0044). The booking already stands
 * without it; this only lets a customer pay something up front if they want.
 *
 * The browser opens Razorpay Checkout and reports success to the customer, but
 * nothing here records the payment — the signed webhook does. So the success
 * state says "confirming" and refreshes until the server agrees.
 */

type RazorpayOptions = {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  handler: () => void
  modal: { ondismiss: () => void }
  theme: { color: string }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void }
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve(Boolean(window.Razorpay))
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export function AdvancePayment({ enquiryId }: { enquiryId: string }) {
  const router = useRouter()
  const [state, action] = useAction(startAdvancePaymentAction)
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'error'>('idle')

  // A new order arrived from the server: open Checkout for it.
  useEffect(() => {
    if (!state?.ok) return
    const order = state.data
    let cancelled = false

    void loadCheckout().then((loaded) => {
      if (cancelled) return
      if (!loaded || !window.Razorpay) {
        setPhase('error')
        return
      }
      new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountMinor,
        currency: order.currency,
        name: 'WeddingMall',
        description: `Advance for ${order.vendorName}`,
        handler: () => setPhase('confirming'),
        modal: { ondismiss: () => undefined },
        theme: { color: '#7f1d1d' },
      }).open()
    })

    return () => {
      cancelled = true
    }
  }, [state])

  // The webhook usually lands within seconds; refresh a few times to show it.
  useEffect(() => {
    if (phase !== 'confirming') return
    let count = 0
    const timer = setInterval(() => {
      router.refresh()
      if (++count >= 10) clearInterval(timer)
    }, 3000)
    return () => clearInterval(timer)
  }, [phase, router])

  if (phase === 'confirming') {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--color-success)_12%,white)] px-3 py-2 text-sm text-[var(--color-success)]"
      >
        <CheckCircle2 aria-hidden="true" className="size-4" />
        Payment received — confirming it now. This page updates by itself.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-3">
      {state && !state.ok ? <FormMessage state={state} /> : null}
      {phase === 'error' ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          The payment window could not load. Check your connection and try again.
        </p>
      ) : null}
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <Field
        label="Advance amount (₹)"
        hint="Optional — your booking stands without it. Pay any amount you like."
        error={fieldError(state, 'amountRupees')}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="amountRupees"
            type="number"
            inputMode="numeric"
            min={MIN_ADVANCE_RUPEES}
            max={MAX_ADVANCE_RUPEES}
            step={1}
            required
            placeholder="e.g. 1000"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <SubmitButton pendingLabel="Opening payment…">
        <CreditCard aria-hidden="true" />
        Pay advance
      </SubmitButton>
    </form>
  )
}
