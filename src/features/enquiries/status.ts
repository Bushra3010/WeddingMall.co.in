/**
 * Enquiry lifecycle (PRD 6.6). Transitions are validated server-side; the UI
 * only uses this map to decide which controls to render.
 */

export const ENQUIRY_STATUSES = [
  'draft',
  'submitted',
  'delivered',
  'viewed',
  'contacted',
  'qualified',
  'quote_sent',
  'negotiating',
  'booked',
  'not_booked',
  'closed',
  'spam',
] as const

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number]

export type TransitionActor = 'customer' | 'vendor' | 'admin' | 'system'

interface Transition {
  to: EnquiryStatus
  actors: readonly TransitionActor[]
  /** Admin-forced transitions must carry a reason (PRD 6.6, 6.11). */
  requiresReason?: boolean
}

const TRANSITIONS: Record<EnquiryStatus, readonly Transition[]> = {
  draft: [{ to: 'submitted', actors: ['customer'] }],
  submitted: [
    { to: 'delivered', actors: ['system'] },
    { to: 'spam', actors: ['admin'], requiresReason: true },
  ],
  delivered: [
    { to: 'viewed', actors: ['vendor'] },
    { to: 'contacted', actors: ['vendor'] },
    { to: 'closed', actors: ['customer', 'admin'], requiresReason: true },
    { to: 'spam', actors: ['vendor', 'admin'], requiresReason: true },
  ],
  viewed: [
    { to: 'contacted', actors: ['vendor'] },
    { to: 'qualified', actors: ['vendor'] },
    { to: 'not_booked', actors: ['vendor'], requiresReason: true },
    { to: 'closed', actors: ['customer', 'admin'], requiresReason: true },
    { to: 'spam', actors: ['vendor', 'admin'], requiresReason: true },
  ],
  contacted: [
    { to: 'qualified', actors: ['vendor'] },
    { to: 'not_booked', actors: ['vendor'], requiresReason: true },
    { to: 'closed', actors: ['customer', 'admin'], requiresReason: true },
    { to: 'spam', actors: ['vendor', 'admin'], requiresReason: true },
  ],
  qualified: [
    { to: 'quote_sent', actors: ['vendor'] },
    { to: 'not_booked', actors: ['vendor'], requiresReason: true },
    { to: 'closed', actors: ['customer', 'admin'], requiresReason: true },
  ],
  quote_sent: [
    { to: 'negotiating', actors: ['vendor', 'customer'] },
    { to: 'booked', actors: ['vendor', 'customer'] },
    { to: 'not_booked', actors: ['vendor'], requiresReason: true },
    { to: 'closed', actors: ['customer', 'admin'], requiresReason: true },
  ],
  negotiating: [
    { to: 'booked', actors: ['vendor', 'customer'] },
    { to: 'not_booked', actors: ['vendor'], requiresReason: true },
    { to: 'closed', actors: ['customer', 'admin'], requiresReason: true },
  ],
  booked: [{ to: 'closed', actors: ['customer', 'vendor', 'admin'] }],
  not_booked: [{ to: 'closed', actors: ['customer', 'vendor', 'admin'] }],
  // Terminal. Reopening is an admin action recorded as a new event.
  closed: [{ to: 'negotiating', actors: ['admin'], requiresReason: true }],
  spam: [{ to: 'delivered', actors: ['admin'], requiresReason: true }],
}

/** Statuses counted by the north-star metric (PRD 13.1). */
export const QUALIFIED_STATUSES: readonly EnquiryStatus[] = [
  'qualified',
  'quote_sent',
  'negotiating',
  'booked',
]

export function allowedTransitions(
  from: EnquiryStatus,
  actor: TransitionActor,
): readonly EnquiryStatus[] {
  return TRANSITIONS[from].filter((t) => t.actors.includes(actor)).map((t) => t.to)
}

export interface TransitionCheck {
  allowed: boolean
  requiresReason: boolean
  reason?: string
}

export function checkTransition(
  from: EnquiryStatus,
  to: EnquiryStatus,
  actor: TransitionActor,
): TransitionCheck {
  if (from === to) {
    return { allowed: false, requiresReason: false, reason: 'Status is already set.' }
  }
  const transition = TRANSITIONS[from].find((t) => t.to === to)
  if (!transition) {
    return { allowed: false, requiresReason: false, reason: `Cannot move from ${from} to ${to}.` }
  }
  if (!transition.actors.includes(actor)) {
    return {
      allowed: false,
      requiresReason: false,
      reason: `A ${actor} cannot move an enquiry to ${to}.`,
    }
  }
  return { allowed: true, requiresReason: transition.requiresReason ?? false }
}

/** Customer- and vendor-facing labels; internal reason codes stay private. */
export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  draft: 'Draft',
  submitted: 'Sent',
  delivered: 'Delivered',
  viewed: 'Seen by vendor',
  contacted: 'Vendor responded',
  qualified: 'In discussion',
  quote_sent: 'Quote received',
  negotiating: 'Negotiating',
  booked: 'Booked',
  not_booked: 'Not booked',
  closed: 'Closed',
  spam: 'Blocked',
}
