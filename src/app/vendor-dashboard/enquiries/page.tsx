import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageSquareText } from 'lucide-react'

import { EmptyState, PermissionDenied } from '@/components/ui/states'
import { ENQUIRY_STATUS_LABELS } from '@/features/enquiries/status'
import { canVendor } from '@/lib/permissions'
import { formatDate, formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { getVendorEnquiries } from '@/server/dal/enquiries'
import { getMyVendors } from '@/server/dal/vendor-workspace'

export const metadata = { title: 'Enquiries', ...NOINDEX }
export const dynamic = 'force-dynamic'

/** Vendor inbox. The pipeline, assignment, and SLA views arrive in Milestone 5. */
export default async function VendorEnquiriesPage() {
  const actor = await getActor()
  const mine = await getMyVendors()
  if (mine.length === 0) redirect('/vendor/join')

  const vendorId = mine[0].vendor.id
  if (!canVendor(actor, vendorId, 'lead.view')) return <PermissionDenied />

  const enquiries = await getVendorEnquiries(vendorId)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Enquiries</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Couples who have contacted you. Replying quickly improves your ranking.
        </p>
      </header>

      {enquiries.length === 0 ? (
        <EmptyState
          title="No enquiries yet"
          description="Once your listing is live, enquiries appear here."
        />
      ) : (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-[var(--radius-card)] border bg-white">
          {enquiries.map((enquiry) => (
            <li key={enquiry.id}>
              <Link
                href={`/vendor-dashboard/enquiries/${enquiry.id}`}
                className="hover:bg-sand-50 block p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sand-900 font-medium">
                    {enquiry.eventDate
                      ? `Wedding on ${formatDate(enquiry.eventDate, 'UTC')}`
                      : 'Date not decided'}
                    {enquiry.unreadCount > 0 ? (
                      <span className="bg-brand-700 ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white">
                        <MessageSquareText aria-hidden="true" className="size-3" />
                        {enquiry.unreadCount} new
                      </span>
                    ) : null}
                  </p>
                  <span className="text-sand-500 text-xs">
                    {ENQUIRY_STATUS_LABELS[enquiry.status]} · {formatRelative(enquiry.createdAt)}
                  </span>
                </div>
                <p className="text-sand-600 mt-1 line-clamp-2 text-sm">
                  {enquiry.guestCount ? `${enquiry.guestCount} guests · ` : ''}
                  {enquiry.message ?? 'No message'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
