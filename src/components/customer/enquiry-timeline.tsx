import { Check, Circle } from 'lucide-react'

import { ENQUIRY_STATUS_LABELS, type EnquiryStatus } from '@/features/enquiries/status'
import { formatDateTime } from '@/lib/dates'
import type { TimelineEvent } from '@/server/dal/enquiries'

/**
 * The customer-facing timeline (PRD 6.6). Friendly labels only — internal
 * reason codes and vendor notes never appear here.
 */
const EVENT_LABELS: Record<string, string> = {
  enquiry_submitted: 'You sent this enquiry',
  enquiry_delivered: 'Delivered to the vendor',
  message_sent: 'Message sent',
  first_response: 'The vendor replied for the first time',
  status_changed: 'Status updated',
}

export function EnquiryTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null

  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="font-display text-sand-900 text-lg">
        Timeline
      </h2>
      <ol className="mt-3 space-y-3">
        {events.map((event, index) => {
          const isLast = index === events.length - 1
          const label =
            event.eventType === 'status_changed' && event.toStatus
              ? `Status: ${ENQUIRY_STATUS_LABELS[event.toStatus as EnquiryStatus] ?? event.toStatus}`
              : (EVENT_LABELS[event.eventType] ?? event.eventType)

          return (
            <li key={event.id} className="flex gap-3 text-sm">
              {isLast ? (
                <Circle aria-hidden="true" className="text-brand-600 mt-0.5 size-4 shrink-0" />
              ) : (
                <Check aria-hidden="true" className="text-sand-400 mt-0.5 size-4 shrink-0" />
              )}
              <div>
                <p className="text-sand-900">{label}</p>
                <p className="text-sand-500 text-xs">{formatDateTime(event.createdAt)}</p>
                {event.reason ? (
                  <p className="text-sand-600 mt-0.5 text-xs">{event.reason}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
