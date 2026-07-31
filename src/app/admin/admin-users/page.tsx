import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Admin users', ...NOINDEX }

export default function AdminAdminUsersPage() {
  return (
    <MilestonePlaceholder
      title={'Admin users'}
      milestone={'Milestone 6'}
      prdSection={'4.4, 6.11'}
      description={'Invite administrators and assign granular roles.'}
    />
  )
}
