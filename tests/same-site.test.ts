import { describe, expect, it } from 'vitest'

import { isSameSite } from '@/lib/same-site'

/**
 * This is the check that decides whether the Android shell keeps a link inside
 * the WebView or hands it to Chrome. Getting it wrong is not cosmetic: the
 * first APK used strict origin equality, and because `weddingmall.co.in`
 * 308-redirects to `www.weddingmall.co.in`, the app bounced straight out to
 * the browser on launch and never rendered.
 */
describe('isSameSite', () => {
  const app = new URL('https://www.weddingmall.co.in/vendors')

  it('treats the apex and the www host as one site', () => {
    // The exact case that broke the APK.
    expect(isSameSite(new URL('https://weddingmall.co.in/vendors/photographers'), app)).toBe(true)
    expect(isSameSite(new URL('https://www.weddingmall.co.in/account'), app)).toBe(true)
  })

  it('works in the other direction too', () => {
    const apex = new URL('https://weddingmall.co.in/')
    expect(isSameSite(new URL('https://www.weddingmall.co.in/account'), apex)).toBe(true)
  })

  it('sends a genuinely external host to the browser', () => {
    for (const href of [
      'https://vendor-own-site.example/gallery',
      'https://weddingmall.co.in.evil.example/',
      'https://notweddingmall.co.in/',
      'https://evilweddingmall.co.in/',
    ]) {
      expect(isSameSite(new URL(href), app), `${href} must be external`).toBe(false)
    }
  })

  it('does not let a protocol downgrade count as the same site', () => {
    // Staying in the WebView means carrying the session; an http link must not
    // qualify just because the host matches.
    expect(isSameSite(new URL('http://www.weddingmall.co.in/account'), app)).toBe(false)
  })

  it('only strips a leading www, not the substring wherever it appears', () => {
    expect(isSameSite(new URL('https://wwwweddingmall.co.in/'), app)).toBe(false)
    expect(isSameSite(new URL('https://api.www.weddingmall.co.in/'), app)).toBe(false)
  })

  it('treats a different port as a different site', () => {
    const local = new URL('http://192.168.1.20:3000/')
    expect(isSameSite(new URL('http://192.168.1.20:3001/'), local)).toBe(false)
    expect(isSameSite(new URL('http://192.168.1.20:3000/vendors'), local)).toBe(true)
  })
})
