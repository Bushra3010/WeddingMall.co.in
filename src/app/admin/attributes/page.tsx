import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Attributes', ...NOINDEX }

export default function AdminAttributesPage() {
  return (
    <MilestonePlaceholder
      title={'Attributes'}
      milestone={'Milestone 2'}
      prdSection={'6.2, 6.11'}
      description={'Category attributes and allowed options that drive search filters.'}
    />
  )
}
