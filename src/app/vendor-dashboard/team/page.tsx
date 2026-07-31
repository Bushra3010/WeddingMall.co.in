import { redirect } from 'next/navigation'

import { TeamManager } from '@/components/vendor/team-manager'
import { PermissionDenied } from '@/components/ui/states'
import { canVendor, vendorRole } from '@/lib/permissions'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { getMyVendors, getTeam } from '@/server/dal/vendor-workspace'

export const metadata = { title: 'Team', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const actor = await getActor()
  const mine = await getMyVendors()
  if (mine.length === 0) redirect('/vendor/join')

  const vendorId = mine[0].vendor.id
  const members = await getTeam(vendorId)

  // A viewer can see who is on the team but not change anything.
  if (!canVendor(actor, vendorId, 'analytics.view')) return <PermissionDenied />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Team</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Invite colleagues and give each of them only the access they need.
        </p>
      </header>

      <TeamManager
        vendorId={vendorId}
        members={members}
        actorRole={vendorRole(actor, vendorId)}
        canManage={canVendor(actor, vendorId, 'team.manage')}
      />
    </div>
  )
}
