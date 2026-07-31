import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Team', ...NOINDEX }

export default function VendorDashboardTeamPage() {
  return (
    <MilestonePlaceholder
      title={'Team'}
      milestone={'Milestone 2'}
      prdSection={'6.9'}
      description={'Invite colleagues and assign membership roles with limited access.'}
    />
  )
}
