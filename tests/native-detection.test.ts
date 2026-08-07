import { describe, expect, it } from 'vitest'

import { isNativeApp, isWebOnlyPath, NATIVE_UA_MARKER } from '@/lib/native'

/**
 * Which requests the mobile apps make, and which routes they do not carry.
 *
 * Written after the marker was found declared under `android` only in
 * `capacitor.config.ts`. Android worked, so the requirement looked met — but
 * the iOS build would have shipped without the marker and served the admin
 * workspace inside the app. Nothing failed; it just quietly would not have
 * done what was asked. Both platforms are asserted here so that cannot recur.
 */
describe('isNativeApp', () => {
  // Capacitor appends the marker to the platform's own UA.
  const IOS = `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ${NATIVE_UA_MARKER}`
  const ANDROID = `Mozilla/5.0 (Linux; Android 14; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 ${NATIVE_UA_MARKER}`

  it('recognises both app platforms', () => {
    expect(isNativeApp(IOS)).toBe(true)
    expect(isNativeApp(ANDROID)).toBe(true)
  })

  it('does not mistake a plain mobile browser for the app', () => {
    // Safari and Chrome on the same handsets, without the marker.
    const browsers = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    ]
    for (const ua of browsers) expect(isNativeApp(ua), ua.slice(0, 40)).toBe(false)
  })

  it('treats a missing user agent as a browser', () => {
    // Absent header must not accidentally block admin for a real browser.
    expect(isNativeApp(null)).toBe(false)
    expect(isNativeApp(undefined)).toBe(false)
    expect(isNativeApp('')).toBe(false)
  })
})

describe('isWebOnlyPath', () => {
  it('covers the admin workspace and everything under it', () => {
    expect(isWebOnlyPath('/admin')).toBe(true)
    expect(isWebOnlyPath('/admin/locations')).toBe(true)
    expect(isWebOnlyPath('/admin/vendors/123')).toBe(true)
  })

  it('leaves the customer and vendor flows alone', () => {
    // The half that matters most: a rule that blocked everything would satisfy
    // "admin is blocked" while making the app useless.
    for (const path of [
      '/',
      '/vendors',
      '/account',
      '/account/enquiries',
      '/vendor-dashboard',
      '/vendor-dashboard/portfolio',
      '/auth/sign-in',
    ]) {
      expect(isWebOnlyPath(path), path).toBe(false)
    }
  })

  it('does not block a path that merely starts with the same letters', () => {
    expect(isWebOnlyPath('/administrators')).toBe(false)
    expect(isWebOnlyPath('/admin-guide')).toBe(false)
  })
})
