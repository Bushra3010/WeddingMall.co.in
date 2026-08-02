/**
 * How a message's sender is named in a thread (PRD 6.7).
 *
 * Extracted from the component so the rule can be tested directly. It is the
 * fix for a real disclosure: the label used to be
 * `senderName ?? counterpartyName`, so any sender without a profile name was
 * announced as the other party. An administrator's messages appeared to a
 * vendor as though the customer had written them, and nothing in the thread
 * revealed otherwise.
 *
 * The rule is: never infer identity from absence. A sender is called the
 * counterparty only when they demonstrably are one.
 */
export function senderLabel({
  senderUserId,
  senderName,
  currentUserId,
  customerId,
  counterpartyName,
}: {
  senderUserId: string
  senderName: string | null
  currentUserId: string
  /** The enquiry's customer. Undefined when the caller could not supply it. */
  customerId?: string
  counterpartyName: string
}): string {
  if (senderUserId === currentUserId) return 'You'

  // Only the known customer may fall back to the counterparty name.
  if (customerId && senderUserId === customerId) return senderName ?? counterpartyName

  /*
   * Everyone else is named, or plainly marked as neither party. When
   * `customerId` is absent we cannot prove the sender is the counterparty, so
   * we do not claim it — an unnamed stranger is better than a wrong name.
   */
  return senderName ?? 'Another participant'
}
