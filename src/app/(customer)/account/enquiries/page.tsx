import Link from 'next/link'
import { MessageSquareText } from 'lucide-react'

import { EmptyState } from '@/components/ui/states'
import { ENQUIRY_STATUS_LABELS } from '@/features/enquiries/status'
import { formatDate, formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { getCustomerEnquiries } from '@/server/dal/enquiries'

export const metadata = { title: 'Your enquiries', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function EnquiriesPage() {
  const enquiries = await getCustomerEnquiries()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Enquiries</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Every vendor you have contacted, and their replies.
        </p>
      </header>

      {enquiries.length === 0 ? (
        <EmptyState
          title="No enquiries yet"
          description="Find a vendor you like and send them your requirements — it takes a minute."
          action={{ label: 'Browse vendors', href: '/vendors' }}
        />
      ) : (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-[var(--radius-card)] border bg-white">
          {enquiries.map((enquiry) => (
            <li key={enquiry.id}>
              <Link
                href={`/account/enquiries/${enquiry.id}`}
                className="hover:bg-sand-50 block p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sand-900 font-medium">
                    {enquiry.vendorName}
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
                <p className="text-sand-600 mt-1 line-clamp-1 text-sm">
                  {enquiry.categoryName ? `${enquiry.categoryName} · ` : ''}
                  {enquiry.eventDate ? formatDate(enquiry.eventDate, 'UTC') : 'Date not set'}
                  {enquiry.guestCount ? ` · ${enquiry.guestCount} guests` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
