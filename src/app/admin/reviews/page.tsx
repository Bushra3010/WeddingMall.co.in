import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Review moderation', ...NOINDEX }

export default function AdminReviewsPage() {
  return (
    <MilestonePlaceholder
      title={'Review moderation'}
      milestone={'Milestone 5'}
      prdSection={'6.8, 6.11'}
      description={'Approve, reject, or flag reviews and vendor responses with a reason.'}
    />
  )
}
