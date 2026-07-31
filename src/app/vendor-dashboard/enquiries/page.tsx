import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Enquiries', ...NOINDEX }

export default function VendorDashboardEnquiriesPage() {
  return (
    <MilestonePlaceholder
      title={'Enquiries'}
      milestone={'Milestone 5'}
      prdSection={'6.6, 6.9'}
      description={
        'Pipeline and table views, assignment, internal notes, follow-ups, and response SLA.'
      }
    />
  )
}
