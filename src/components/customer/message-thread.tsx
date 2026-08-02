'use client'

import { Send } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Textarea } from '@/components/ui/field'
import { useLiveMessages } from '@/components/customer/use-live-messages'
import { sendMessageAction } from '@/features/enquiries/actions'
import { formatDateTime } from '@/lib/dates'
import { senderLabel } from '@/features/messaging/sender-label'
import { cn } from '@/lib/utils'
import type { MessageRow } from '@/server/dal/enquiries'

/**
 * One thread per enquiry (PRD 6.7). Plain text only for now — attachments need
 * malware scanning before they can be accepted, which is not built.
 */
export function MessageThread({
  enquiryId,
  conversationId,
  liveEnabled = false,
  messages,
  currentUserId,
  customerId,
  counterpartyName,
  locked,
}: {
  enquiryId: string
  conversationId?: string | null
  /** Off unless the deployment enables it; the thread works either way. */
  liveEnabled?: boolean
  messages: MessageRow[]
  currentUserId: string
  /** The enquiry's customer. Anyone else on the thread is not them. */
  customerId?: string
  counterpartyName: string
  locked: boolean
}) {
  const [state, action] = useAction(sendMessageAction)
  useLiveMessages(conversationId ?? null, liveEnabled)

  return (
    <section aria-labelledby="thread-heading" className="space-y-4">
      <h2 id="thread-heading" className="font-display text-sand-900 text-lg">
        Conversation
      </h2>

      {messages.length === 0 ? (
        <p className="border-sand-300 text-sand-600 rounded-[var(--radius-card)] border border-dashed bg-white p-6 text-center text-sm">
          No messages yet. {counterpartyName} will see your enquiry and can reply here.
        </p>
      ) : (
        <ol className="space-y-3">
          {messages.map((message) => {
            const mine = message.senderUserId === currentUserId

            // Extracted so the rule is unit-tested rather than eyeballed;
            // see features/messaging/sender-label.ts for why it exists.
            const label = senderLabel({
              senderUserId: message.senderUserId,
              senderName: message.senderName,
              currentUserId,
              customerId,
              counterpartyName,
            })

            return (
              <li key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-[var(--radius-card)] px-4 py-3 text-sm',
                    mine
                      ? 'bg-brand-700 text-white'
                      : 'border-sand-200 text-sand-900 border bg-white',
                  )}
                >
                  <p className="whitespace-pre-line">{message.body}</p>
                  <p
                    className={cn('mt-1.5 text-[11px]', mine ? 'text-brand-100' : 'text-sand-500')}
                  >
                    {label} · {formatDateTime(message.createdAt)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {locked ? (
        <p className="border-sand-300 bg-sand-50 text-sand-700 rounded-lg border p-3 text-sm">
          This conversation is closed. Reopen the enquiry to continue.
        </p>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="enquiryId" value={enquiryId} />
          <FormMessage state={state} />

          <label htmlFor="message-body" className="sr-only">
            Write a message
          </label>
          <Textarea
            id="message-body"
            name="body"
            required
            maxLength={5000}
            rows={3}
            placeholder={`Write to ${counterpartyName}…`}
            invalid={Boolean(fieldError(state, 'body'))}
          />
          {fieldError(state, 'body') ? (
            <p role="alert" className="text-xs text-[var(--color-danger)]">
              {fieldError(state, 'body')}
            </p>
          ) : null}

          <SubmitButton pendingLabel="Sending…">
            <Send aria-hidden="true" />
            Send
          </SubmitButton>
        </form>
      )}
    </section>
  )
}
