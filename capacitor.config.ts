import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Android shell for WEDDING MALL.
 *
 * ## Why this loads the live site rather than a bundled build
 *
 * The usual Capacitor setup ships a static export inside the APK. This app
 * cannot do that, and it is not a close call: there are 17 `'use server'`
 * modules and 52 `force-dynamic` routes. `output: 'export'` refuses to build a
 * project containing a single Server Action, so bundling would mean deleting
 * the entire mutation layer and re-implementing it as client-side Supabase
 * calls — which would also move authorisation into the client, the one thing
 * the architecture rules forbid.
 *
 * Pointing the WebView at the deployed origin keeps Server Components, Server
 * Actions and RLS exactly as they are on the web, and it is also the only
 * arrangement that satisfies the brief's first requirement: every content or UI
 * change is live in the app the moment it deploys, because the app is showing
 * the same pages the browser is. There is no bundled copy to go stale, and no
 * store review between a fix and its users.
 *
 * The trade is real and worth stating: the app needs a connection to do
 * anything beyond the offline page, and a shell this thin has to earn its place
 * on the Play Store under the "minimum functionality" policy — which is what
 * the splash screen, back-button handling, external-link handling and installed
 * file-picker integration below are for.
 *
 * ## Local development
 *
 * Set `CAP_SERVER_URL` to a LAN address (not localhost — that resolves to the
 * device itself) and `CAP_ALLOW_CLEARTEXT=true` for plain http:
 *
 *   CAP_SERVER_URL=http://192.168.1.20:3000 CAP_ALLOW_CLEARTEXT=true npx cap sync android
 */

/*
 * The canonical host, with the `www`, and that matters more than it looks.
 *
 * `weddingmall.co.in` 308-redirects to `www.weddingmall.co.in`. Capacitor
 * compares every navigation against `server.hostname` and hands anything that
 * does not match to the system browser — so pointing the app at the apex made
 * it redirect straight out to Chrome on launch, before rendering a thing.
 * Always configure the URL the server actually settles on, not the one you type.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? 'https://www.weddingmall.co.in'
const allowCleartext = process.env.CAP_ALLOW_CLEARTEXT === 'true'

const config: CapacitorConfig = {
  appId: 'com.weddingmall.app',
  appName: 'WEDDING MALL',
  /*
   * Only reached when the origin above cannot be loaded at launch. `cap sync`
   * requires the directory to exist whether or not it is used.
   */
  webDir: 'capacitor/www',

  server: {
    url: serverUrl,
    /*
     * Lets the WebView load the deployed origin over the network instead of
     * treating it as a foreign site to be blocked.
     */
    hostname: new URL(serverUrl).host,
    androidScheme: 'https',
    cleartext: allowCleartext,
    /*
     * Hosts that stay inside the WebView. The apex is listed because links
     * written without the `www` still resolve here after the redirect, and
     * Supabase because auth and storage responses must not bounce a user out
     * to the browser mid-flow. Anything not on this list opens externally,
     * which is the behaviour we want for a vendor's own site.
     */
    allowNavigation: ['www.weddingmall.co.in', 'weddingmall.co.in', '*.supabase.co'],
  },

  android: {
    /*
     * Read server-side by `lib/native.ts` to keep /admin out of the app. It is
     * a routing signal, not authorisation — see that file.
     */
    appendUserAgent: 'WeddingMallApp',
    // Text should follow the app's own scale, not the system font size, or the
    // layouts that were just fixed for 390px reflow unpredictably.
    useLegacyBridge: false,
    backgroundColor: '#460c07',
  },

  plugins: {
    SplashScreen: {
      /*
       * Hidden explicitly by `NativeShell` once React has mounted, rather than
       * on a timer. A fixed duration either flashes the splash away before the
       * first paint or holds it after the page is ready; `launchAutoHide: false`
       * hands that decision to the thing that actually knows.
       *
       * `launchShowDuration` remains as a backstop: if the JS never boots, the
       * splash must not become a permanent screen.
       */
      launchAutoHide: false,
      launchShowDuration: 10_000,
      backgroundColor: '#460c07',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#460c07',
      overlaysWebView: false,
    },
  },
}

export default config
