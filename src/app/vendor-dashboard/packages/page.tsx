import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Packages', ...NOINDEX }

export default function VendorDashboardPackagesPage() {
  return (
    <MilestonePlaceholder
      title={'Packages'}
      milestone={'Milestone 3'}
      prdSection={'6.9'}
      description={'Named packages with inclusions, exclusions, price type, and currency.'}
    />
  )
}
