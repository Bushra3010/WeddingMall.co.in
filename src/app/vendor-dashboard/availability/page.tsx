import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Availability', ...NOINDEX }

export default function VendorDashboardAvailabilityPage() {
  return (
    <MilestonePlaceholder
      title={'Availability'}
      milestone={'Milestone 3'}
      prdSection={'6.9'}
      description={'Mark dates available, busy, or unavailable. Private notes stay private.'}
    />
  )
}
