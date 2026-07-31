import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Listing editor', ...NOINDEX }

export default function VendorDashboardListingPage() {
  return (
    <MilestonePlaceholder
      title={'Listing editor'}
      milestone={'Milestone 3'}
      prdSection={'6.9'}
      description={
        'Autosaving draft editor with section validation, preview, and submission for review.'
      }
    />
  )
}
