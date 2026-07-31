import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Platform settings', ...NOINDEX }

export default function AdminSettingsPage() {
  return (
    <MilestonePlaceholder
      title={'Platform settings'}
      milestone={'Milestone 6'}
      prdSection={'6.11'}
      description={'Feature flags, policies, and operational configuration.'}
    />
  )
}
