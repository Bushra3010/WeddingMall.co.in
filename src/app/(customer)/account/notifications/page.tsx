import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Notifications', ...NOINDEX }

export default function CustomerAccountNotificationsPage() {
  return (
    <MilestonePlaceholder
      title={'Notifications'}
      milestone={'Milestone 4'}
      prdSection={'6.12'}
      description={'In-app notifications and your channel preferences.'}
    />
  )
}
