import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EnquiryTimeline } from '@/components/customer/enquiry-timeline'
import { MessageThread } from '@/components/customer/message-thread'
import { EnquiryActions } from '@/components/customer/enquiry-actions'
import { EnquiryDealFields, EnquiryNotes } from '@/components/vendor/enquiry-crm'
import { ENQUIRY_STATUS_LABELS } from '@/features/enquiries/status'
import { formatDate, formatDateTime } from '@/lib/dates'
import { formatRange, money } from '@/lib/money'
import { canVendor } from '@/lib/permissions'
import { serverEnv } from '@/lib/env'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import {
  getCustomerContact,
  getEnquiry,
  getEnquiryNotes,
  getEnquiryTimeline,
  getMessages,
} from '@/server/dal/enquiries'
import { markEnquiryViewed, markMessagesRead } from '@/server/services/enquiries'

export const metadata = { title: 'Enquiry', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function VendorEnquiryPage({
  params,
}: {
  params: Promise<{ enquiryId: string }>
}) {
  const { enquiryId } = await params
  const actor = await getActor()

  // Off unless the deployment turns it on; the thread polls either way.
  const liveChat = serverEnv().FEATURE_REALTIME_CHAT

  const enquiry = await getEnquiry(enquiryId)
  if (!enquiry) notFound()

  // Opening a delivered enquiry moves it to "viewed" — the customer sees this
  // on their timeline, which is the point of the status.
  await markEnquiryViewed(actor, enquiryId)
  await markMessagesRead(actor, enquiryId)

  const [messages, timeline, contact, notes] = await Promise.all([
    enquiry.conversationId ? getMessages(enquiry.conversationId) : Promise.resolve([]),
    getEnquiryTimeline(enquiryId),
    // Contact details are released only with the customer's consent, and only
    // to a member who may see lead PII (PRD 2.3, 4.4).
    canVendor(actor, enquiry.vendorId, 'lead.view_pii')
      ? getCustomerContact(enquiryId)
      : Promise.resolve(null),
    // RLS returns an empty list for anyone who may not read the team's notes,
    // so this is safe to fetch before the capability check below.
    getEnquiryNotes(enquiryId),
  ])

  const budget = formatRange(
    enquiry.budgetMinMinor ? money(enquiry.budgetMinMinor, enquiry.currency) : null,
    enquiry.budgetMaxMinor ? money(enquiry.budgetMaxMinor, enquiry.currency) : null,
  )

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sand-500 text-xs">
        <Link href="/vendor-dashboard/enquiries" className="hover:text-brand-700">
          Enquiries
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-sand-700">Enquiry</span>
      </nav>

      <header>
        <h1 className="font-display text-sand-900 text-2xl">
          {enquiry.eventDate
            ? `Wedding on ${formatDate(enquiry.eventDate, 'UTC')}`
            : 'Date not decided'}
        </h1>
        <p className="text-sand-600 mt-1 text-sm">
          {ENQUIRY_STATUS_LABELS[enquiry.status]} · received {formatDateTime(enquiry.createdAt)}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-8">
          <section className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <h2 className="font-display text-sand-900 text-lg">Requirements</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ['Guests', enquiry.guestCount ? String(enquiry.guestCount) : '—'],
                ['Budget', budget ?? '—'],
                ['City', enquiry.cityName ?? '—'],
                ['Prefers', enquiry.preferredContactMode ?? '—'],
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
          </section>

          <section className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <h2 className="font-display text-sand-900 text-lg">Contact details</h2>
            {contact ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-sand-500 text-xs tracking-wide uppercase">Name</dt>
                  <dd className="text-sand-900">{contact.fullName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-sand-500 text-xs tracking-wide uppercase">Phone</dt>
                  <dd className="text-sand-900">{contact.phone ?? '—'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sand-600 mt-2 text-sm">
                {enquiry.contactConsent
                  ? 'Your role does not include access to customer contact details.'
                  : 'This customer has not shared their contact details. Reply in the thread below.'}
              </p>
            )}
          </section>

          {enquiry.conversationId ? (
            <MessageThread
              enquiryId={enquiry.id}
              customerId={enquiry.customerId}
              canSend={Boolean(actor.vendorRoles[enquiry.vendorId])}
              conversationId={enquiry.conversationId}
              liveEnabled={liveChat}
              messages={messages}
              currentUserId={actor.userId ?? ''}
              counterpartyName="the customer"
              locked={enquiry.conversationStatus !== 'open'}
            />
          ) : null}
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {canVendor(actor, enquiry.vendorId, 'lead.respond') ? (
            <>
              <EnquiryActions enquiryId={enquiry.id} status={enquiry.status} actorType="vendor" />
              <EnquiryDealFields
                enquiryId={enquiry.id}
                quoteAmountMinor={enquiry.quoteAmountMinor}
                lostReason={enquiry.lostReason}
                currency={enquiry.currency}
              />
            </>
          ) : null}

          {/*
            Notes are gated on `note.manage`, not `lead.respond`: a member who
            may reply to a customer is not automatically one who may read the
            team's private commentary about them.
          */}
          {canVendor(actor, enquiry.vendorId, 'note.manage') ? (
            <EnquiryNotes enquiryId={enquiry.id} notes={notes} />
          ) : null}
          <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <EnquiryTimeline events={timeline} />
          </div>
        </div>
      </div>
    </div>
  )
}
