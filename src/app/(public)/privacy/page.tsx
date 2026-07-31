import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'Privacy policy',
  description: 'How we collect, use, and retain your data. Legal text pending counsel review.',
  path: '/privacy',
  noindex: true,
})

export default function PublicPrivacyPage() {
  return (
    <MilestonePlaceholder
      title={'Privacy policy'}
      milestone={'Milestone 7'}
      prdSection={'14.3'}
      description={'How we collect, use, and retain your data. Legal text pending counsel review.'}
    />
  )
}
