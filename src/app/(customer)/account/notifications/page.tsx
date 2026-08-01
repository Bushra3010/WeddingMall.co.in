import Link from 'next/link'

import { EmptyState } from '@/components/ui/states'
import { MarkAllReadButton } from '@/components/customer/mark-all-read'
import { formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { getNotifications } from '@/server/dal/enquiries'

export const metadata = { title: 'Notifications', ...NOINDEX }
export const dynamic = 'force-dynamic'

const LABELS: Record<string, string> = {
  'enquiry.new': 'You have a new enquiry',
  'message.new': 'New message on an enquiry',
}

export default async function NotificationsPage() {
  const notifications = await getNotifications()
  const unread = notifications.filter((n) => !n.readAt).length

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-sand-900 text-2xl">Notifications</h1>
          <p className="text-sand-600 mt-1 text-sm">
            {unread > 0 ? `${unread} unread` : 'You are up to date.'}
          </p>
        </div>
        {unread > 0 ? <MarkAllReadButton /> : null}
      </header>

      {notifications.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="We will tell you here when a vendor replies to an enquiry."
        />
      ) : (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-[var(--radius-card)] border bg-white">
          {notifications.map((notification) => {
            const enquiryId = notification.payload.enquiryId as string | undefined
            const body = (
              <div className={notification.readAt ? 'opacity-60' : ''}>
                <p className="text-sand-900 text-sm font-medium">
                  {LABELS[notification.code] ?? notification.code}
                </p>
                <p className="text-sand-500 text-xs">{formatRelative(notification.createdAt)}</p>
              </div>
            )
            return (
              <li key={notification.id} className="p-4">
                {enquiryId ? (
                  <Link href={`/account/enquiries/${enquiryId}`} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
