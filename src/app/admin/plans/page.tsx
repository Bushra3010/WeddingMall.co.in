import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Plans', ...NOINDEX }

export default function AdminPlansPage() {
  return (
    <MilestonePlaceholder
      title={'Plans'}
      milestone={'Milestone 6'}
      prdSection={'6.10, 6.11'}
      description={'Configure plans, entitlements, prices, and trials.'}
    />
  )
}
