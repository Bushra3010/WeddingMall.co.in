import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Services', ...NOINDEX }

export default function VendorDashboardServicesPage() {
  return (
    <MilestonePlaceholder
      title={'Services'}
      milestone={'Milestone 3'}
      prdSection={'6.2, 6.9'}
      description={'Category attributes that power the filters customers search with.'}
    />
  )
}
