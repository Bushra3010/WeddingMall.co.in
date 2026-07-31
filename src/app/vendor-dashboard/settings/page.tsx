import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Settings', ...NOINDEX }

export default function VendorDashboardSettingsPage() {
  return (
    <MilestonePlaceholder
      title={'Settings'}
      milestone={'Milestone 2'}
      prdSection={'6.9'}
      description={'Notification preferences and business account settings.'}
    />
  )
}
