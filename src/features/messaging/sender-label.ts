/**
 * How a message's sender is named in a thread (PRD 6.7).
 *
 * ## Real names only
 *
 * Both sides must be able to tell who they are talking to, so this returns the
 * customer's account name and the vendor's registered business name — never
 * "Customer", "Vendor", or "the customer". A generic label on a marketplace
 * thread is worse than useless: the customer already knows they are a
 * customer, and the vendor needs to know *which* customer.
 *
 * ## Why the side is passed in rather than inferred
 *
 * `senderRole` is resolved in the DAL, where the vendor's membership list is
 * available. Inferring it here — "not me, therefore the other party" — is
 * exactly how an administrator's messages were once displayed to a vendor as
 * the customer's words. A third party is labelled as itself, never as a party.
 */
export interface SenderLabelInput {
  senderName: string | null
  senderRole: 'customer' | 'vendor' | 'other'
  /** The customer's account name, when they have set one. */
  customerName: string | null
  /** The vendor's registered business name. */
  vendorName: string
}

export function senderLabel({
  senderName,
  senderRole,
  customerName,
  vendorName,
}: SenderLabelInput): string {
  if (senderRole === 'vendor') {
    /*
     * The business name, not the staff member's. The customer enquired with a
     * business; which employee happens to be replying is internal detail, and
     * showing a stranger's personal name where they expect the business reads
     * as the wrong person answering.
     */
    return vendorName
  }

  if (senderRole === 'customer') {
    // Their own account name. `senderName` and `customerName` are the same
    // person; the first is per-message and the second is the enquiry's record,
    // so either being present is enough.
    return senderName ?? customerName ?? 'This customer'
  }

  // Neither party — an administrator, historically. Named if we can, and
  // otherwise plainly marked as someone who is not in the conversation.
  return senderName ?? 'Not a participant'
}
