import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Enquiries', ...NOINDEX }

export default function CustomerAccountEnquiriesPage() {
  return (
    <MilestonePlaceholder
      title={'Enquiries'}
      milestone={'Milestone 4'}
      prdSection={'6.5, 6.6'}
      description={
        'Every enquiry you have sent, its status, and the conversation with each vendor.'
      }
    />
  )
}
