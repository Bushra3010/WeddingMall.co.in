import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'Contact',
  description: 'Get in touch with our support team.',
  path: '/contact',
  noindex: true,
})

export default function PublicContactPage() {
  return (
    <MilestonePlaceholder
      title={'Contact'}
      milestone={'Milestone 6'}
      prdSection={'6.11'}
      description={'Get in touch with our support team.'}
    />
  )
}
