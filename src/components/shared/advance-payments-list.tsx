import { formatDateTime } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import type { AdvancePayment } from '@/server/dal/booking-payments'

/** Paid advances on a booking, for both the customer's and the vendor's view. */
export function AdvancePaymentsList({ payments }: { payments: AdvancePayment[] }) {
  const paid = payments.filter((payment) => payment.status === 'paid')
  if (paid.length === 0) return null

  return (
    <ul className="divide-sand-200 border-sand-200 divide-y rounded-lg border text-sm">
      {paid.map((payment) => (
        <li key={payment.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-sand-900 font-medium">
            {formatMoney(money(payment.amountMinor, payment.currency))} paid
          </span>
          <span className="text-sand-500 text-xs">
            {payment.paidAt ? formatDateTime(payment.paidAt) : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}
