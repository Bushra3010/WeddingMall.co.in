import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Shortlist', ...NOINDEX }

export default function CustomerAccountShortlistPage() {
  return (
    <MilestonePlaceholder
      title={'Shortlist'}
      milestone={'Milestone 4'}
      prdSection={'6.5'}
      description={'Vendors you have saved, grouped by category, with your private notes.'}
    />
  )
}
