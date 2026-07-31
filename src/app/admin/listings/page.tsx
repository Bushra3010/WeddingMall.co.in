import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Listing moderation', ...NOINDEX }

export default function AdminListingsPage() {
  return (
    <MilestonePlaceholder
      title={'Listing moderation'}
      milestone={'Milestone 3'}
      prdSection={'6.11'}
      description={'Approve, reject, or request changes on submitted listing versions.'}
    />
  )
}
