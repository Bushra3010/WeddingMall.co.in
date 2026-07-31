import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'Ideas and guides',
  description: 'Planning guides, real weddings, and vendor advice.',
  path: '/blog',
  noindex: true,
})

export default function PublicBlogPage() {
  return (
    <MilestonePlaceholder
      title={'Ideas and guides'}
      milestone={'Milestone 6'}
      prdSection={'6.11'}
      description={'Planning guides, real weddings, and vendor advice.'}
    />
  )
}
