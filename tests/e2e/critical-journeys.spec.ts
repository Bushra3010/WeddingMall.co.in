import { test } from '@playwright/test'

/**
 * The three critical journeys from PRD 17.4 / Epic G.
 *
 * Each is skipped until the milestone that implements it. They are written out
 * now so the acceptance target is explicit and reviewable, and so the file does
 * not get invented from scratch under time pressure at the end.
 *
 * Unskip each one in the milestone named on it. A journey must not be marked
 * done while its test is still skipped.
 */

test.describe('Journey 1 — customer discovery to enquiry', () => {
  test.skip(true, 'Implemented in Milestone 4 (wedding profile, shortlist, enquiry, messaging)')

  test('sign up, search, shortlist, enquire, and message', async () => {
    // 1. Sign up and confirm the account.
    // 2. Search by category and city.
    // 3. Open a published vendor profile.
    // 4. Add to shortlist; confirm it survives a reload.
    // 5. Submit an enquiry with explicit contact consent.
    // 6. Confirm enquiry_events records submitted -> delivered.
    // 7. Send a message in the thread and confirm the vendor receives it.
  })
})

test.describe('Journey 2 — vendor onboarding to lead handling', () => {
  test.skip(true, 'Implemented in Milestone 5 (approval, publication, vendor CRM)')

  test('onboard, verify, publish, and handle a lead', async () => {
    // 1. Sign up as a vendor and complete onboarding.
    // 2. Upload a verification document to the private bucket.
    // 3. Submit for review; confirm the listing is not publicly visible.
    // 4. Admin approves; confirm the profile becomes publicly reachable.
    // 5. Receive an enquiry and move it through the status pipeline.
    // 6. Confirm each transition wrote an immutable enquiry_events row.
  })
})

test.describe('Journey 3 — admin moderation and reporting', () => {
  test.skip(true, 'Implemented in Milestone 6 (moderation, reports, audit)')

  test('moderate a review, export a report, and verify the audit trail', async () => {
    // 1. Sign in as an admin holding review.moderate.
    // 2. Approve a pending review with a reason.
    // 3. Confirm the vendor rating aggregate updates only after approval.
    // 4. Export an aggregate CSV report with a stated reason.
    // 5. Confirm audit_logs contains the decision and the export.
  })
})
