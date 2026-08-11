# WEDDING MALL — PWA and Android app

The same codebase serves four things: the website, an installable PWA, an
Android app and an iOS app. There is no second project and no separate mobile
build of the UI.

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

### What this means day to day

**A UI or content change does not need a new APK.** The app's HTML, CSS and
JavaScript come from the deployed site, so a fix is live in the app as soon as
Vercel finishes deploying — including changes to `NativeShell` itself.

A new APK is only needed when something *native* changes: `capacitor.config.ts`,
the Android manifest, icons, splash, or a Capacitor plugin.

This is easy to trip over while debugging. A JS change made locally will not
appear in the app no matter how many times you rebuild the APK, because the APK
is not where that code lives.

---

## What is in the app, and what is not

| Surface | In the app | Notes |
| --- | --- | --- |
| Public browsing, search, vendor profiles | yes | |
| Customer login and `/account/*` | yes | |
| Vendor login and `/vendor-dashboard/*` | yes | includes photo/document upload |
| `/admin/*` | **no** | redirects to `/app/web-only`, on both platforms |

### How the admin block works — and what it is not

Capacitor appends `WeddingMallApp` to the WebView user agent
(`capacitor.config.ts` → root-level `appendUserAgent`). `src/proxy.ts` reads it
and redirects `/admin` to a notice page.

The marker sits at the **root** of the config, not under `android`, and that
placement is load-bearing. It started per-platform, which meant the iOS build
would have shipped without it and quietly served the admin workspace inside the
app — the requirement unmet on one platform with nothing failing to show it.
`tests/native-detection.test.ts` and `tests/e2e/pwa.spec.ts` now assert both
platforms.

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

`localhost` on a phone means the phone. Use the machine's LAN address for a real
device, or `10.0.2.2` for the standard Android emulator (its alias for the
host's loopback):

```bash
CAP_SERVER_URL=http://192.168.1.20:3000 CAP_ALLOW_CLEARTEXT=true npx cap sync android
```

Undo it before building a release — the value is baked into the APK:

```bash
npx cap sync android
```

Note: the emulator route (`10.0.2.2`) did not come up in testing here — the
WebView sat on the splash with no network error logged, and it was not worth
chasing further because it is a convenience path, not the shipping one. The LAN
address on a real device is the better-trodden route. Everything else in this
document was verified against the production URL.

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

# iOS

Added with `npx cap add ios`. Bundle identifier `com.weddingmall.app`, display
name `WEDDING MALL`, deployment target iOS 15.

Everything above about the architecture applies unchanged: the WebView loads the
deployed origin, so the same "a web change ships by deploying, a native change
ships by rebuilding" rule holds. The service worker, the manifest, the admin
block and the external-link handling are all shared code.

## What is iOS-specific

**Swipe-back** (`ios/App/App/MainViewController.swift`). iOS has no hardware
back button, so the left-edge swipe is the only native way back — and
`WKWebView` ships with it disabled. Capacitor neither enables it nor exposes an
option for it, so a `CAPBridgeViewController` subclass sets
`allowsBackForwardNavigationGestures = true`. Without this the app has no back
affordance at all beyond whatever the page draws.

**File upload permissions** (`ios/App/App/Info.plist`). `NSCameraUsageDescription`,
`NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` and
`NSMicrophoneUsageDescription`. iOS does not merely deny an undeclared
permission — it **terminates the process** the moment the picker asks for it, so
a missing key is a crash on the vendor's portfolio screen, not a declined
prompt. The strings are shown verbatim to the user and App Review rejects vague
ones.

**External links** open in `SFSafariViewController` — the same `@capacitor/browser`
call the Android build uses, which maps to the native in-app Safari sheet.

**App icon** is flattened onto the cream ground with no alpha channel: the App
Store rejects an icon containing transparency at upload.

**`limitsNavigationsToAppBoundDomains` is off** deliberately. Turning it on
restricts the WebView to domains listed in `WKAppBoundDomains`, which would
break Supabase auth and storage — both are separate origins this app talks to.

## Requirements

- **Xcode 15 or newer**, from the Mac App Store (~15 GB). The command-line tools
  alone are not enough — `xcodebuild` and `simctl` both come from the full app.
- **CocoaPods**. The system Ruby on macOS is 2.6, which modern CocoaPods no
  longer supports. The cleanest fix is a current Ruby:

```bash
brew install ruby && gem install cocoapods
```

## Commands

### 1. Build the web app and sync

```bash
npm run build && npx cap sync ios
```

### 2. Open in Xcode

```bash
npx cap open ios
```

That opens `ios/App/App.xcworkspace`. Open the **workspace**, never
`App.xcodeproj` — the project alone has no pods and will not link.

### 3. Signing with your Apple ID

In Xcode: select the **App** target → **Signing & Capabilities**.

1. Tick **Automatically manage signing**
2. **Team** → *Add an Account…* and sign in with your Apple ID
3. Xcode provisions a free development certificate

A free Apple ID can install on your own devices, but the build expires after
7 days and cannot be distributed. TestFlight and the App Store need the paid
Apple Developer Program ($99/year).

If Xcode reports the bundle identifier is unavailable, someone has already
registered `com.weddingmall.app`; change it in **Signing & Capabilities** and
keep `capacitor.config.ts` in step.

### 4. Run on the simulator

```bash
npx cap run ios
```

Or press ▶ in Xcode with a simulator selected.

### 5. Run on a real device

1. Connect the iPhone by cable and trust the Mac
2. Select it in Xcode's device menu, press ▶
3. First run only, on the phone: **Settings → General → VPN & Device Management
   → Developer App → Trust**

### 6. Generate an IPA

Archive the app:

```bash
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath build/App.xcarchive archive
```

Then export. Create `build/ExportOptions.plist`:

```bash
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>YOUR_TEAM_ID</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
```

```bash
xcodebuild -exportArchive -archivePath build/App.xcarchive -exportOptionsPlist build/ExportOptions.plist -exportPath build/ipa
```

Output: `build/ipa/App.ipa`. Use `method` of `development` or `ad-hoc` for a
build you want to install directly rather than upload.

The GUI route is equivalent and easier the first time: **Product → Archive**,
then **Distribute App** in the Organizer.

### 7. Upload to App Store Connect

Create the app record first at appstoreconnect.apple.com with bundle ID
`com.weddingmall.app`, then:

```bash
xcrun altool --upload-app -f build/ipa/App.ipa -t ios --apiKey YOUR_KEY_ID --apiIssuer YOUR_ISSUER_ID
```

An API key from App Store Connect → Users and Access → Integrations avoids
putting your Apple ID password on a command line. Xcode's Organizer
**Distribute App** does the same thing through the GUI.

### Bumping the version for each upload

App Store Connect rejects a build number it has already seen:

```bash
cd ios/App && agvtool next-version -all
```

## Build status: verified

Xcode 26.6 with the iOS 26.5 SDK and simulator runtime. The project **builds**
and **runs**:

```bash
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator build
```

`** BUILD SUCCEEDED **`, and the app installs and launches on an iPhone 17
simulator: it loads the live site, renders correctly with the notch and home
indicator respected (`contentInset: 'always'` doing its job), and the process
stays alive rather than crashing.

Two template defects were fixed to get there:

1. **The generated Podfile does not install.** It pins `platform :ios, '14.0'`
   while every Capacitor 8 pod requires 15.0, so `pod install` fails on a fresh
   `cap add ios`. The Podfile and all four `IPHONEOS_DEPLOYMENT_TARGET` entries
   are now 15.0.
2. **`colors.xml`-equivalent gaps** — see the Android section; the iOS template
   was cleaner, but the deployment-target mismatch is the same class of problem.

### Verified on the simulator

Driven on an iPhone 17 (iOS 26.5):

- **Launches and loads the live site**, notch and home indicator respected.
- **Splash screen** renders — the flat-white mark on brand maroon, matching
  Android.
- **In-app navigation works**, including the auth redirect for a signed-out tap
  on Shortlist.
- **Swipe-back works.** A left-edge swipe returned from the sign-in page to the
  homepage, which is `MainViewController` doing the one job it exists for.
- **The user-agent marker is really sent.** Pointed at a local echo server, the
  WebView reported:
  `Mozilla/5.0 (iPhone; …) Mobile/15E148 WeddingMallApp`.
  That was the last unproven link in the admin block: the server-side redirect
  is covered by `tests/e2e/pwa.spec.ts` for an iOS-shaped agent, and this
  confirms the app actually sends it.

### Still unverified

- **Vendor file upload.** The four `Info.plist` usage strings are present and
  validated, but reaching the picker needs a signed-in vendor account, which the
  test account is not. This is the one that *crashes* rather than degrades if a
  key is wrong, so open Portfolio → upload early on a real account.
- **Anything requiring a signed build**: running on a physical iPhone, archiving,
  and App Store upload all need an Apple ID attached in Xcode.

### Also verified without Xcode

```bash
npm run verify:ios
```

14 structural checks that run anywhere — project opens, no dangling file
references, the Swift file is in Compile Sources, bundle id and deployment
target consistent, storyboard names a class that exists, asset catalogs
reference real images, the icon is 1024x1024 with no alpha (an App Store
rejection that otherwise lands after the archive is built), Podfile and lock
agree.

---

## Play Store target API level

`targetSdkVersion` is **36**, which meets Google Play's requirement for new apps
and updates from 31 August 2026. `compileSdk` is 36 and `minSdk` is 23.

API 36 makes edge-to-edge layout mandatory, so this was checked on an emulator
rather than assumed: the header still starts at the same pixel row it did under
API 35 (y=130 on a 1080×2400 Pixel 6), the bottom tab bar still clears the
gesture bar, and navigation and the back button behave identically.
`StatusBar.overlaysWebView: false` in `capacitor.config.ts` is what keeps the
WebView out from under the status bar.
