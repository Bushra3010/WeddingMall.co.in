import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Content', ...NOINDEX }

export default function AdminContentPage() {
  return (
    <MilestonePlaceholder
      title={'Content'}
      milestone={'Milestone 6'}
      prdSection={'6.11'}
      description={'Pages, FAQs, testimonials, and homepage collections.'}
    />
  )
}
