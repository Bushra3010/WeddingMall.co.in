import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Privacy', ...NOINDEX }

export default function CustomerAccountPrivacyPage() {
  return (
    <MilestonePlaceholder
      title={'Privacy'}
      milestone={'Milestone 6'}
      prdSection={'6.5, 14.3'}
      description={'Consent history, data export requests, and account deletion.'}
    />
  )
}
