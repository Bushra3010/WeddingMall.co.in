import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'About',
  description: 'Who we are and how the marketplace works.',
  path: '/about',
  noindex: true,
})

export default function PublicAboutPage() {
  return (
    <MilestonePlaceholder
      title={'About'}
      milestone={'Milestone 6'}
      prdSection={'6.11'}
      description={'Who we are and how the marketplace works.'}
    />
  )
}
