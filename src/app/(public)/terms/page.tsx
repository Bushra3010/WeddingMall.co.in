import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'Terms of use',
  description: 'The terms that govern use of the platform. Legal text pending counsel review.',
  path: '/terms',
  noindex: true,
})

export default function PublicTermsPage() {
  return (
    <MilestonePlaceholder
      title={'Terms of use'}
      milestone={'Milestone 7'}
      prdSection={'14.3'}
      description={'The terms that govern use of the platform. Legal text pending counsel review.'}
    />
  )
}
