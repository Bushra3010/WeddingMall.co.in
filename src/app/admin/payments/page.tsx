import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Payments', ...NOINDEX }

export default function AdminPaymentsPage() {
  return (
    <MilestonePlaceholder
      title={'Payments'}
      milestone={'Milestone 6'}
      prdSection={'6.10, 6.11'}
      description={'Subscription and payment records, including manual confirmations.'}
    />
  )
}
