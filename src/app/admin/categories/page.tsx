import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Categories', ...NOINDEX }

export default function AdminCategoriesPage() {
  return (
    <MilestonePlaceholder
      title={'Categories'}
      milestone={'Milestone 2'}
      prdSection={'6.11'}
      description={'Categories, subcategories, and their SEO templates.'}
    />
  )
}
