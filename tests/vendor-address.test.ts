import { describe, expect, it } from 'vitest'

import { vendorProfileSchema } from '@/features/vendors/schema'

/**
 * The address and map link added to the Business step.
 *
 * The distinction worth pinning is `undefined` vs `''`. Two forms post to
 * `saveProfileAction` — the wizard's Business step and the onboarding page —
 * and the service skips the address write entirely when both are `undefined`.
 * If a form that lacks the inputs sent `''` instead, saving there would erase
 * an address entered on the other one. Clearing still has to work, so the two
 * cannot collapse into one value.
 */

const BASE = {
  displayName: 'Marigold Courtyard',
  primaryCityId: '9a2b1c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
  legalName: '',
  email: '',
  phone: '',
  website: '',
}

describe('vendorProfileSchema — address and location link', () => {
  it('accepts a profile with neither field, since both are optional', () => {
    const parsed = vendorProfileSchema.parse(BASE)
    expect(parsed.addressLine).toBeUndefined()
    expect(parsed.mapsUrl).toBeUndefined()
  })

  it('keeps empty string distinct from absent', () => {
    // '' means "the vendor cleared it"; undefined means "this form has no such
    // field". The service treats them differently and must be able to.
    const cleared = vendorProfileSchema.parse({ ...BASE, addressLine: '', mapsUrl: '' })
    expect(cleared.addressLine).toBe('')
    expect(cleared.mapsUrl).toBe('')
  })

  it('takes a normal street address', () => {
    const parsed = vendorProfileSchema.parse({
      ...BASE,
      addressLine: '12 Civil Lines, Near Ganga Temple',
    })
    expect(parsed.addressLine).toBe('12 Civil Lines, Near Ganga Temple')
  })

  it('accepts map links from more than one provider', () => {
    for (const url of [
      'https://maps.app.goo.gl/abc123',
      'https://www.google.com/maps/place/Marigold+Courtyard/@26.9124,75.7873,17z',
      'https://maps.apple.com/?ll=26.9124,75.7873',
      'https://www.openstreetmap.org/#map=17/26.9124/75.7873',
    ]) {
      expect(vendorProfileSchema.safeParse({ ...BASE, mapsUrl: url }).success, url).toBe(true)
    }
  })

  it('refuses a location link that is not a URL', () => {
    // A vendor pasting "near the temple" would otherwise get a dead link on
    // their public profile.
    const result = vendorProfileSchema.safeParse({ ...BASE, mapsUrl: 'near the temple' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['mapsUrl'])
  })

  it('neither field is required to save the rest of the business details', () => {
    // The whole point of the request: these must never block the step.
    expect(vendorProfileSchema.safeParse(BASE).success).toBe(true)
    expect(vendorProfileSchema.safeParse({ ...BASE, addressLine: '', mapsUrl: '' }).success).toBe(
      true,
    )
  })
})
