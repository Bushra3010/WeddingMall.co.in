import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Customers', ...NOINDEX }

export default function AdminCustomersPage() {
  return (
    <MilestonePlaceholder
      title={'Customers'}
      milestone={'Milestone 5'}
      prdSection={'6.11'}
      description={'Support view of customer accounts, restricted by permission.'}
    />
  )
}
