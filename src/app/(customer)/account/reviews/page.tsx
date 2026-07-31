import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Your reviews', ...NOINDEX }

export default function CustomerAccountReviewsPage() {
  return (
    <MilestonePlaceholder
      title={'Your reviews'}
      milestone={'Milestone 5'}
      prdSection={'6.8'}
      description={'Reviews you have written, their moderation state, and vendor responses.'}
    />
  )
}
