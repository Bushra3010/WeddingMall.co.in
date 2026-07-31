import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'Help centre',
  description: 'Answers to common questions for couples and vendors.',
  path: '/help',
  noindex: true,
})

export default function PublicHelpPage() {
  return (
    <MilestonePlaceholder
      title={'Help centre'}
      milestone={'Milestone 6'}
      prdSection={'6.11'}
      description={'Answers to common questions for couples and vendors.'}
    />
  )
}
