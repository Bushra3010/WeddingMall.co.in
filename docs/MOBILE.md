# WEDDING MALL — PWA and Android app

The same codebase serves three things: the website, an installable PWA, and an
Android app. There is no second project and no separate mobile build of the UI.

---

## How the Android app is put together, and why

Capacitor's usual setup bundles a static export of the site inside the APK.
**This app cannot do that**, and it is not a close call:

- 17 modules are `'use server'` (Server Actions)
- 52 routes are `force-dynamic`

`output: 'export'` refuses to build a project containing a single Server Action.
Bundling would mean deleting the whole mutation layer and rewriting it as
client-side Supabase calls — which would also move authorisation into the
client, the one thing `CLAUDE.md` forbids.

So the WebView loads the deployed origin (`capacitor.config.ts` →
`server.url`). Server Components, Server Actions and RLS work exactly as they do
on the web.

**This is also what makes the auto-update requirement true rather than
aspirational.** The app is showing the same pages the browser is, so a content,
price or UI change is live the moment it deploys. There is no bundled copy to go
stale and no store review between a fix and its users.

The trade, stated plainly: the app needs a connection to do anything past the
offline screen, and a shell this thin has to earn its place under Google Play's
"minimum functionality" policy — which is what the splash screen, back-button
handling, external-link handling, deep links and native file picker are for. If
Play review pushes back, the answer is more native capability (push
notifications are the obvious next one), not a bundled export.

---

## What is in the app, and what is not

| Surface | In the app | Notes |
| --- | --- | --- |
| Public browsing, search, vendor profiles | yes | |
| Customer login and `/account/*` | yes | |
| Vendor login and `/vendor-dashboard/*` | yes | includes photo/document upload |
| `/admin/*` | **no** | redirects to `/app/web-only` |

### How the admin block works — and what it is not

Capacitor appends `WeddingMallApp` to the WebView user agent
(`capacitor.config.ts` → `android.appendUserAgent`). `src/proxy.ts` reads it and
redirects `/admin` to a notice page.

**This is product scope, not a security boundary.** A user agent is a request
header: anyone can send it and anyone can remove it. Admin authorisation is
unchanged — `requireAdmin`, `assertPermission` on every mutation, and RLS on
every table. Someone who strips the header reaches the same login and the same
policies they would in a browser. If admin access from a phone must be genuinely
impossible, that belongs in the permission catalogue and RLS, not in a string
comparison. See `src/lib/native.ts`.

---

## Caching: why almost nothing is cached

The brief was "no aggressive caching, never show stale content". The service
worker (`public/sw.js`) therefore does the opposite of most PWA templates.

**Cached:**

- `/_next/static/**` — Next fingerprints these with a content hash, so the URL
  changes the moment the content does. The cache invalidates itself and cannot
  go stale. This is where the bytes are, and the only place cache-first is safe.
- `/offline` — the fallback for a failed navigation.

**Never cached:**

- **HTML.** Not one page. Every route renders per request, so a cached copy is
  stale as soon as a vendor edits a listing — and pages under `/account`,
  `/vendor-dashboard` and `/admin` are rendered for one signed-in person. A
  cache is not partitioned by session, so storing those risks handing one
  account's page to whoever opens the app next.
- **Anything that is not a same-origin GET.** Server Actions are POSTs.
- **RSC payloads** (`?_rsc=`) — the client-navigation equivalent of HTML.
- **Images.** An image that fails should fail, not resurrect a version the
  vendor replaced.

`skipWaiting` + `clients.claim` means a new worker takes over on the next load
rather than waiting for every tab to close, and non-current caches are deleted
on activate.

Verified against a production build: the caches held 21 `_next/static` entries
plus `/offline`, and **no HTML**.

### If a release ever needs backing out

From the browser console on the site:

```bash
navigator.serviceWorker.controller.postMessage('UNREGISTER')
```

That drops every cache and unregisters the worker, so a bad release is
recoverable without asking people to clear site data.

---

## Commands

### 1. Build the web app

```bash
npm run build
```

### 2. Sync the native project

Copies the web config and plugins into `android/`. Run after every dependency
or `capacitor.config.ts` change.

```bash
npx cap sync android
```

### 3. Open Android Studio

```bash
npx cap open android
```

### 4. Run on a connected device or emulator

```bash
npx cap run android
```

### Pointing the app at a local dev server

`localhost` on a phone means the phone. Use the machine's LAN address:

```bash
CAP_SERVER_URL=http://192.168.1.20:3000 CAP_ALLOW_CLEARTEXT=true npx cap sync android
```

Undo it before building a release:

```bash
npx cap sync android
```

---

## Signed APK / AAB

### One-time: create a keystore

Keep this file and its passwords safe and **out of git** (`.gitignore` already
excludes `*.jks`, `*.keystore` and `android/keystore.properties`). Android has
no key rotation for an app already on the Play Store — losing it means losing
the ability to publish updates to that listing.

```bash
keytool -genkey -v -keystore weddingmall-release.jks -alias weddingmall -keyalg RSA -keysize 2048 -validity 10000
```

### One-time: tell Gradle about it

The signing config is **already wired** in `android/app/build.gradle` — it reads
`android/keystore.properties` if that file exists and builds unsigned if it does
not, so a fresh clone and CI still work. You only need to create the file:

```bash
storeFile=/absolute/path/to/weddingmall-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=weddingmall
keyPassword=YOUR_KEY_PASSWORD
```

It is untracked. Verified with a throwaway keystore, which produced a correctly
signed `app-release.apk`; the key was deleted straight after.

### Build the signed APK

```bash
cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### Build the signed AAB (what Play Store wants)

```bash
cd android && ./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### Full release, from a clean tree

```bash
npm run verify && npx cap sync android && cd android && ./gradlew clean bundleRelease
```

---

## Requirements for the machine that builds the APK

Already installed here (see "Toolchain installed here" below). This section is
for setting up a second machine.

- **JDK 21** (Android Gradle Plugin 8.10 requires 17 or later; 21 is what this
  project was built and verified with)
- **Android SDK 36** with Platform-Tools and Build-Tools 35.0.0+. Android Studio
  is optional — the command-line tools are enough to build, and are what was
  used here.
- `ANDROID_HOME` set, e.g. `export ANDROID_HOME=$HOME/Library/Android/sdk`

```bash
brew install --cask temurin@21
brew install --cask android-studio
```

Then open Android Studio once so it downloads the SDK, and:

```bash
echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.zshrc
```

---

## Deep links

`AndroidManifest.xml` claims `https://weddingmall.co.in` with
`android:autoVerify="true"`, so links open in the app instead of the browser.
Android only honours it silently once the site serves a matching
`/.well-known/assetlinks.json`. Until that file is published the link opens in
the browser, which is the safe failure.

To generate it, take the release keystore's SHA-256 fingerprint:

```bash
keytool -list -v -keystore weddingmall-release.jks -alias weddingmall | grep SHA256
```

and publish at `https://weddingmall.co.in/.well-known/assetlinks.json`:

```bash
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.weddingmall.app",
    "sha256_cert_fingerprints": ["YOUR:SHA256:FINGERPRINT"]
  }
}]
```

If the app is enrolled in Play App Signing, use the fingerprint Play shows, not
the local keystore's — they differ.

---

## Build status: verified

`./gradlew assembleDebug`, `assembleRelease` and `bundleRelease` all succeed on
this machine, against JDK 21.0.12 (Temurin) and Android SDK 36.

| Artifact | Size |
| --- | --- |
| `app/build/outputs/apk/debug/app-debug.apk` | 4.5 MB |
| `app/build/outputs/apk/release/app-release-unsigned.apk` | 3.2 MB |
| `app/build/outputs/bundle/release/app-release.aab` | 3.1 MB |

Checked inside the APK rather than trusting the exit code: package
`com.weddingmall.app`, label `WEDDING MALL`, the launcher icon is the
WeddingMall mark (not the template robot), splash present at every density, the
four upload permissions, and `server.url` / `appendUserAgent` baked into
`assets/capacitor.config.json`.

The release signing config was tested with a throwaway keystore, which produced
a correctly signed `app-release.apk`; the key was deleted immediately after. So
the Gradle wiring is proven — you supply the real keystore and it works.

### Three things the first build exposed

The generated Capacitor template does not build as shipped. All three are fixed
and committed:

1. **`colors.xml` did not exist.** `styles.xml` referenced `@color/colorPrimary`
   and `@color/colorPrimaryDark`, which fails resource linking.
2. **AGP 8.7.2 was too old.** `androidx.browser:browser:1.9.0`, pulled in by
   `@capacitor/browser`, requires AGP 8.9.1+ and is compiled against API 36.
   Now AGP 8.10.1 with `compileSdkVersion = 36`.
3. **Duplicate Kotlin stdlib classes.** Something in the Cordova compatibility
   chain pins `kotlin-stdlib-jdk8:1.6.21` while `kotlin-stdlib` resolves to
   1.8.22 — and Kotlin 1.8 merged the jdk7/jdk8 content into the main artifact,
   so both jars carry the same classes. `android/app/build.gradle` now aligns
   every `kotlin-stdlib*` artifact on one version, which is Kotlin's own remedy
   (at 1.8+ the `-jdk7`/`-jdk8` modules are empty and just delegate).

### Toolchain installed here

Home directory only — nothing was written to a system path and no password was
needed.

```bash
export JAVA_HOME="$HOME/Library/Java/jdk-21.0.12+8/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

Add those to `~/.zshrc` to build from a fresh shell. `android/local.properties`
holds `sdk.dir` and is untracked, because it is an absolute path specific to
this machine.

---

## Open: Play Store target API deadline

`targetSdkVersion` is **35**. From **31 August 2026** Google Play requires new
apps and updates to target **API 36**. `compileSdk` is already 36, so the change
is one line in `android/variables.gradle`.

It was left at 35 deliberately: API 36 makes edge-to-edge layout mandatory,
which changes how the WebView sits under the status bar and the gesture bar.
`StatusBar.overlaysWebView: false` in `capacitor.config.ts` should handle it,
but "should" is not "does" — that needs checking on a real device or emulator,
which has not been done. Bumping it blind three weeks before a deadline is how
you ship an app whose header sits under the clock.
