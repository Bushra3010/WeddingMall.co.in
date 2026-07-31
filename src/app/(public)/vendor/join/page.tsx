import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'List your business',
  description: 'Create a vendor account, submit verification, and publish your listing.',
  path: '/vendor/join',
  noindex: true,
})

export default function PublicVendorJoinPage() {
  return (
    <MilestonePlaceholder
      title={'List your business'}
      milestone={'Milestone 2'}
      prdSection={'6.4'}
      description={'Create a vendor account, submit verification, and publish your listing.'}
    />
  )
}
