import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Audit log', ...NOINDEX }

export default function AdminAuditLogPage() {
  return (
    <MilestonePlaceholder
      title={'Audit log'}
      milestone={'Milestone 6'}
      prdSection={'6.11, 10.3'}
      description={'Immutable record of admin decisions, PII reveals, exports, and role changes.'}
    />
  )
}
