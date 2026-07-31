import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Reports', ...NOINDEX }

export default function AdminReportsPage() {
  return (
    <MilestonePlaceholder
      title={'Reports'}
      milestone={'Milestone 6'}
      prdSection={'6.11, 13'}
      description={'Aggregate analytics with date filters and PII-minimised CSV export.'}
    />
  )
}
