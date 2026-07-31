import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Vendor dashboard', ...NOINDEX }

export default function VendorDashboardPage() {
  return (
    <MilestonePlaceholder
      title={'Vendor dashboard'}
      milestone={'Milestone 2'}
      prdSection={'6.9'}
      description={
        'Profile completion, verification status, new and overdue enquiries, and 30-day performance.'
      }
    />
  )
}
