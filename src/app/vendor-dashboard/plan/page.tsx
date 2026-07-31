import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Plan and billing', ...NOINDEX }

export default function VendorDashboardPlanPage() {
  return (
    <MilestonePlaceholder
      title={'Plan and billing'}
      milestone={'Milestone 6'}
      prdSection={'6.10'}
      description={'Your current plan, entitlements, renewal date, and payment history.'}
    />
  )
}
