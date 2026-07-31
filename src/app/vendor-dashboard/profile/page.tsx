import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Business profile', ...NOINDEX }

export default function VendorDashboardProfilePage() {
  return (
    <MilestonePlaceholder
      title={'Business profile'}
      milestone={'Milestone 2'}
      prdSection={'6.4'}
      description={'Your legal and contact details, and where they appear publicly.'}
    />
  )
}
