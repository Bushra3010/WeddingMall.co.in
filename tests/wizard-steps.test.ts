import { describe, expect, it } from 'vitest'

import { STEPS, isStepComplete, isStepUnlocked } from '@/components/vendor/wizard-config'
import type { VendorWorkspace } from '@/server/dal/vendor-workspace'

/**
 * The onboarding wizard's gating rules.
 *
 * These decide what a vendor can click, so the failure mode is either a dead
 * end (a step that will not open) or a contradiction on screen (a padlock next
 * to an available final step). Both were real, and both are covered below.
 */

function vendor(overrides: Partial<VendorWorkspace> = {}): VendorWorkspace {
  const base = {
    id: 'v1',
    status: 'draft',
    submittedAt: null,
    displayName: null,
    primaryCityId: null,
    about: null,
    mediaCount: 0,
    documentCount: 0,
    completion: { canSubmit: false, fields: [], score: 0, missingRequired: [] },
  }
  return { ...base, ...overrides } as unknown as VendorWorkspace
}

/** A vendor that has filled everything the wizard treats as a step. */
function finished(overrides: Partial<VendorWorkspace> = {}): VendorWorkspace {
  return vendor({
    displayName: 'Marigold Courtyard',
    primaryCityId: 'c1',
    about: 'x'.repeat(60),
    mediaCount: 3,
    documentCount: 1,
    completion: {
      canSubmit: true,
      score: 100,
      missingRequired: [],
      fields: [
        { key: 'categories', done: true },
        { key: 'serviceAreas', done: true },
      ],
    },
    ...overrides,
  } as Partial<VendorWorkspace>)
}

describe('isStepComplete', () => {
  it('does not tick Submit merely because the listing could be submitted', () => {
    // The bug this replaces showed a checkmark on the final step while an
    // earlier one was still locked.
    const ready = finished()
    expect(ready.completion.canSubmit).toBe(true)
    expect(isStepComplete('submit', ready)).toBe(false)
  })

  it('ticks Submit once the listing has actually been sent for review', () => {
    expect(isStepComplete('submit', finished({ submittedAt: '2026-08-26T10:00:00Z' }))).toBe(true)
    expect(isStepComplete('submit', finished({ status: 'pending_review' }))).toBe(true)
  })

  it('does not tick Submit for a registration that has not been filled in', () => {
    /*
     * Since migration 0035 a vendor registers straight into `pending_review`
     * with a `submitted_at`, so "has been submitted" is true from the first
     * second — before they have written a description or picked a category.
     * Ticking the final step there tells someone they have finished a form they
     * have not started.
     */
    const justRegistered = vendor({
      displayName: 'Pearl Banquet Hall',
      primaryCityId: 'c1',
      status: 'pending_review',
      submittedAt: '2026-08-27T10:50:56Z',
    })

    expect(isStepComplete('submit', justRegistered)).toBe(false)
    expect(isStepUnlocked('submit', justRegistered)).toBe(false)
  })

  it('requires a real about, not just any text', () => {
    expect(isStepComplete('about', vendor({ about: 'too short' }))).toBe(false)
    expect(isStepComplete('about', vendor({ about: 'x'.repeat(50) }))).toBe(true)
  })

  it('treats three photos as the bar for media', () => {
    expect(isStepComplete('media', vendor({ mediaCount: 2 }))).toBe(false)
    expect(isStepComplete('media', vendor({ mediaCount: 3 }))).toBe(true)
  })
})

describe('isStepUnlocked', () => {
  it('opens only the first unfinished step for a brand new vendor', () => {
    const fresh = vendor()
    expect(isStepUnlocked('business', fresh)).toBe(true)
    expect(isStepUnlocked('about', fresh)).toBe(false)
    expect(isStepUnlocked('submit', fresh)).toBe(false)
  })

  it('lets a vendor go back to a step they already finished', () => {
    const v = vendor({ displayName: 'Marigold', primaryCityId: 'c1' })
    expect(isStepComplete('business', v)).toBe(true)
    expect(isStepUnlocked('business', v)).toBe(true)
    expect(isStepUnlocked('about', v)).toBe(true)
  })

  it('never locks a step while a later one is available', () => {
    /*
     * Media and documents are optional for submission, so a vendor could reach
     * `canSubmit` with neither — which left Documents padlocked beside an open
     * Submit. Whatever the inputs, the unlocked steps must be a prefix.
     */
    const cases = [
      vendor(),
      finished({ mediaCount: 0, documentCount: 0 }),
      finished({ mediaCount: 3, documentCount: 0 }),
      finished(),
    ]

    for (const v of cases) {
      const unlocked = STEPS.map((s) => isStepUnlocked(s.id, v))
      const firstLocked = unlocked.indexOf(false)
      if (firstLocked === -1) continue
      expect(
        unlocked.slice(firstLocked).every((open) => !open),
        `steps after the first lock must stay locked: ${unlocked.join(',')}`,
      ).toBe(true)
    }
  })
})
