'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { isSameSite } from '@/lib/same-site'

/**
 * The behaviours an Android WebView does not get for free.
 *
 * All four plugin imports are dynamic. `@capacitor/core` is a dependency of the
 * web build too, and importing the plugins at module scope would ship their
 * code — and their `window`-touching initialisation — to every browser visitor
 * for the benefit of the small fraction using the app. Loading them only after
 * `isNativePlatform()` is confirmed keeps the web bundle unchanged.
 */
export function NativeShell() {
  const router = useRouter()
  useEffect(() => {
    let disposed = false
    const cleanups: Array<() => void> = []

    void (async () => {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform() || disposed) return

      const [{ App }, { Browser }, { SplashScreen }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/browser'),
        import('@capacitor/splash-screen'),
      ])
      if (disposed) return

      // React has mounted and the first paint has happened, so the splash has
      // done its job. Any earlier and the user sees a white flash.
      await SplashScreen.hide()

      /*
       * Android's hardware back button.
       *
       * Pop the WebView's history if there is any; exit only when there is
       * none. `canGoBack` is the WebView's own history, so this follows the
       * same stack the on-screen back arrow does.
       *
       * An earlier version also treated the top-level tabs as exit points,
       * which was wrong and showed up the first time it ran on a device: going
       * Home -> Explore and pressing back closed the app instead of returning
       * Home, because `/vendors` was in that list. History is the only thing
       * that knows whether there is somewhere to go back to.
       */
      const backHandle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          router.back()
          return
        }
        void App.exitApp()
      })
      cleanups.push(() => void backHandle.remove())

      /*
       * External links.
       *
       * A link to a payment provider or a vendor's own site must not replace
       * the app's only WebView — there is no address bar to get back from.
       * Capturing at the document level catches links rendered anywhere,
       * including inside vendor-supplied content.
       */
      const onClick = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

        const anchor = (event.target as Element | null)?.closest?.('a')
        if (!anchor) return

        const href = anchor.getAttribute('href')
        if (!href) return
        // Let the platform handle tel:, mailto: and sms: — the dialer and mail
        // app are the right destinations and Browser would not open them.
        if (/^(tel:|mailto:|sms:)/i.test(href)) return

        let target: URL
        try {
          target = new URL(href, window.location.href)
        } catch {
          return
        }
        if (isSameSite(target, new URL(window.location.href))) return

        event.preventDefault()
        void Browser.open({ url: target.href, presentationStyle: 'popover' })
      }
      document.addEventListener('click', onClick, { capture: true })
      cleanups.push(() => document.removeEventListener('click', onClick, { capture: true }))

      /*
       * Deep links and any navigation Android hands to the app. Same-origin
       * paths are routed in place; anything else opens outside, so a malicious
       * link cannot drive the app's own WebView somewhere it should not go.
       */
      const urlHandle = await App.addListener('appUrlOpen', ({ url }) => {
        try {
          const parsed = new URL(url)
          if (isSameSite(parsed, new URL(window.location.href))) {
            router.push(parsed.pathname + parsed.search)
          } else {
            void Browser.open({ url })
          }
        } catch {
          /* Not a URL we can act on. */
        }
      })
      cleanups.push(() => void urlHandle.remove())
    })()

    return () => {
      disposed = true
      for (const cleanup of cleanups) cleanup()
    }
  }, [router])

  return null
}
