import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Settings', ...NOINDEX }

export default function CustomerAccountSettingsPage() {
  return (
    <MilestonePlaceholder
      title={'Settings'}
      milestone={'Milestone 4'}
      prdSection={'6.5'}
      description={'Your profile details and notification preferences.'}
    />
  )
}
