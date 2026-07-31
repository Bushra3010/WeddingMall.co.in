import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Vendors', ...NOINDEX }

export default function AdminVendorsPage() {
  return (
    <MilestonePlaceholder
      title={'Vendors'}
      milestone={'Milestone 2'}
      prdSection={'6.11'}
      description={'Search, inspect, approve, suspend, and merge vendor accounts.'}
    />
  )
}
