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

Create `android/keystore.properties` (untracked):

```bash
storeFile=/absolute/path/to/weddingmall-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=weddingmall
keyPassword=YOUR_KEY_PASSWORD
```

Then add the signing config to `android/app/build.gradle` — inside `android {}`,
above `buildTypes`:

```bash
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
}
```

and point the release build type at it:

```bash
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

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

Not installed on the machine this was set up on, so the Gradle build has not
been run here — see the caveat at the bottom.

- **JDK 21** (Android Gradle Plugin 8.7+ requires 17 or later; 21 is the current
  default in Android Studio)
- **Android Studio** (Ladybug or newer) with the Android SDK, Platform-Tools and
  a Build-Tools release installed
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

## Not verified on this machine

The Android project is scaffolded, configured, synced, and its resources are
generated and checked in. **`./gradlew assembleRelease` has not been run**,
because this machine has no JDK, no Android SDK and no Android Studio. The
manifest, Gradle config, icons and splash are all in place and `npx cap sync
android` completes clean, but the first Gradle build on a properly equipped
machine is where a missing SDK component or a version mismatch would surface.

One thing already fixed that would have failed that build: the generated
template referenced `@color/colorPrimary` and `@color/colorPrimaryDark` without
defining them anywhere. `android/app/src/main/res/values/colors.xml` now does.
