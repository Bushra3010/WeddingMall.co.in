import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Blog', ...NOINDEX }

export default function AdminBlogPage() {
  return (
    <MilestonePlaceholder
      title={'Blog'}
      milestone={'Milestone 6'}
      prdSection={'6.11'}
      description={'Editorial posts with drafts, scheduling, and revision history.'}
    />
  )
}
