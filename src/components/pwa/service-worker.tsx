'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker, and keeps it from ever being the reason
 * someone sees an old page.
 *
 * Three things beyond a bare `register()`:
 *
 * 1. **`updateViaCache: 'none'`** — by default the browser may serve `sw.js`
 *    itself from the HTTP cache for up to 24 hours, which means a fix to the
 *    worker can sit unapplied for a day. This forces the script to be
 *    revalidated every time.
 * 2. **An update check on every load and on regaining focus.** A long-lived
 *    installed app can go days without a navigation that triggers one.
 * 3. **Activating a waiting worker immediately** rather than waiting for every
 *    tab to close, which is the usual reason a "new version" never arrives.
 *
 * Registration is skipped in development: an installed worker survives the dev
 * server restarting, and debugging a stale asset that is actually a stale
 * worker costs more time than the feature saves.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | undefined

    const promoteWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING')
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        registration = reg
        promoteWaiting(reg)
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') promoteWaiting(reg)
          })
        })
      })
      .catch(() => {
        // A failed registration must never break the page. The site works
        // without a worker; that is the whole point of the caching strategy.
      })

    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') void registration?.update()
    }
    document.addEventListener('visibilitychange', checkForUpdate)

    /*
     * When the controller changes, the page is being served by a worker it did
     * not start with. Reloading once picks up the matching assets; the guard
     * stops the reload loop this pattern is famous for.
     */
    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      document.removeEventListener('visibilitychange', checkForUpdate)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return null
}
