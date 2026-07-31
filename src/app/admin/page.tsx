import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Admin dashboard', ...NOINDEX }

export default function AdminPage() {
  return (
    <MilestonePlaceholder
      title={'Admin dashboard'}
      milestone={'Milestone 2'}
      prdSection={'6.11'}
      description={'Queues, supply and demand, response SLA, and moderation alerts.'}
    />
  )
}
