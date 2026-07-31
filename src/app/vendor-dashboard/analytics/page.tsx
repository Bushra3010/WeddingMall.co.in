import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Analytics', ...NOINDEX }

export default function VendorDashboardAnalyticsPage() {
  return (
    <MilestonePlaceholder
      title={'Analytics'}
      milestone={'Milestone 5'}
      prdSection={'6.9, 13'}
      description={'Views, shortlist adds, enquiries, response rate, and conversion.'}
    />
  )
}
