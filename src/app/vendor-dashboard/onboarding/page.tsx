import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Onboarding', ...NOINDEX }

export default function VendorDashboardOnboardingPage() {
  return (
    <MilestonePlaceholder
      title={'Onboarding'}
      milestone={'Milestone 2'}
      prdSection={'6.4'}
      description={
        'Business details, categories, service areas, verification documents, and submission for review.'
      }
    />
  )
}
