import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Leads', ...NOINDEX }

export default function AdminLeadsPage() {
  return (
    <MilestonePlaceholder
      title={'Leads'}
      milestone={'Milestone 5'}
      prdSection={'6.11'}
      description={'Full enquiry timelines, delivery status, consent and PII audit, and exports.'}
    />
  )
}
