import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'

import { EnquiryTimeline } from '@/components/customer/enquiry-timeline'
import { MessageThread } from '@/components/customer/message-thread'
import { EnquiryActions } from '@/components/customer/enquiry-actions'
import { ENQUIRY_STATUS_LABELS } from '@/features/enquiries/status'
import { formatDate, formatDateTime } from '@/lib/dates'
import { formatRange, money } from '@/lib/money'
import { serverEnv } from '@/lib/env'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { getEnquiry, getEnquiryTimeline, getMessages } from '@/server/dal/enquiries'
import { markMessagesRead } from '@/server/services/enquiries'

export const metadata = { title: 'Enquiry', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function EnquiryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ enquiryId: string }>
  searchParams: Promise<{ sent?: string }>
}) {
  const { enquiryId } = await params
  const { sent } = await searchParams

  const actor = await getActor()
  // Off unless the deployment turns it on; the thread polls either way.
  const liveChat = serverEnv().FEATURE_REALTIME_CHAT

  const enquiry = await getEnquiry(enquiryId)
  // RLS already restricts this read to participants, so a miss is either
  // "gone" or "not yours" — both are a 404 from here.
  if (!enquiry) notFound()

  const [messages, timeline] = await Promise.all([
    enquiry.conversationId ? getMessages(enquiry.conversationId) : Promise.resolve([]),
    getEnquiryTimeline(enquiryId),
  ])

  // Opening the thread clears the unread badge.
  await markMessagesRead(actor, enquiryId)

  const budget = formatRange(
    enquiry.budgetMinMinor ? money(enquiry.budgetMinMinor, enquiry.currency) : null,
    enquiry.budgetMaxMinor ? money(enquiry.budgetMaxMinor, enquiry.currency) : null,
  )

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sand-500 text-xs">
        <Link href="/account/enquiries" className="hover:text-brand-700">
          Enquiries
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-sand-700">{enquiry.vendorName}</span>
      </nav>

      {sent ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--color-success)_12%,white)] px-3 py-2 text-sm text-[var(--color-success)]"
        >
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Your enquiry has been sent.
        </p>
      ) : null}

      <header>
        <h1 className="font-display text-sand-900 text-2xl">
          <Link href={`/vendor/${enquiry.vendorSlug}`} className="hover:underline">
            {enquiry.vendorName}
          </Link>
        </h1>
        <p className="text-sand-600 mt-1 text-sm">
          {ENQUIRY_STATUS_LABELS[enquiry.status]} · sent {formatDateTime(enquiry.createdAt)}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-8">
          <section className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <h2 className="font-display text-sand-900 text-lg">What you asked</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                [
                  'Date',
                  enquiry.eventDate
                    ? formatDate(enquiry.eventDate, 'UTC')
                    : enquiry.flexibleDate
                      ? `${enquiry.flexibleDate} (flexible)`
                      : 'Not decided',
                ],
                ['Guests', enquiry.guestCount ? String(enquiry.guestCount) : '—'],
                ['Budget', budget ?? '—'],
                ['City', enquiry.cityName ?? '—'],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-sand-500 text-xs tracking-wide uppercase">{label}</dt>
                  <dd className="text-sand-900 text-sm">{value}</dd>
                </div>
              ))}
            </dl>
            {enquiry.message ? (
              <p className="border-sand-200 text-sand-700 mt-4 border-t pt-4 text-sm whitespace-pre-line">
                {enquiry.message}
              </p>
            ) : null}
            <p className="text-sand-500 mt-3 text-xs">
              {enquiry.contactConsent
                ? 'You agreed to share your name and phone number with this vendor.'
                : 'Your contact details have not been shared. They can only reply here.'}
            </p>
          </section>

          {enquiry.conversationId ? (
            <MessageThread
              enquiryId={enquiry.id}
              customerId={enquiry.customerId}
              // The party check the database makes, mirrored so the composer
              // is not offered to an admin whose write RLS will refuse (0030).
              canSend={actor.userId === enquiry.customerId}
              conversationId={enquiry.conversationId}
              liveEnabled={liveChat}
              messages={messages}
              currentUserId={actor.userId ?? ''}
              counterpartyName={enquiry.vendorName}
              locked={enquiry.conversationStatus !== 'open'}
            />
          ) : null}
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <EnquiryActions enquiryId={enquiry.id} status={enquiry.status} actorType="customer" />
          <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <EnquiryTimeline events={timeline} />
          </div>
        </div>
      </div>
    </div>
  )
}
