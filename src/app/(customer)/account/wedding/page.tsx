import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Wedding profile', ...NOINDEX }

export default function CustomerAccountWeddingPage() {
  return (
    <MilestonePlaceholder
      title={'Wedding profile'}
      milestone={'Milestone 4'}
      prdSection={'6.5'}
      description={
        'Your wedding date, city, budget, guest count, and the categories you still need.'
      }
    />
  )
}
