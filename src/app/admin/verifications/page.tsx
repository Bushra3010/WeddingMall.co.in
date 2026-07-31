import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Verifications', ...NOINDEX }

export default function AdminVerificationsPage() {
  return (
    <MilestonePlaceholder
      title={'Verifications'}
      milestone={'Milestone 2'}
      prdSection={'6.11'}
      description={'Review submitted documents and decide verification with a reason.'}
    />
  )
}
