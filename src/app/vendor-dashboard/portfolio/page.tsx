import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Portfolio', ...NOINDEX }

export default function VendorDashboardPortfolioPage() {
  return (
    <MilestonePlaceholder
      title={'Portfolio'}
      milestone={'Milestone 3'}
      prdSection={'6.9'}
      description={
        'Upload, order, and caption your images. Every image is moderated before it goes live.'
      }
    />
  )
}
