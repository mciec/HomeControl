# HomeControlMobile

React Native (bare React Native CLI, TypeScript) recreation of [HomeControlFrontEnd](../HomeControlFrontEnd), talking to the same [HomeControlBackEnd](../HomeControlBackEnd) API. See [[keep-frontends-in-sync]] in project memory: a change made in one frontend should normally be ported to the other.

This app was migrated off Expo (managed workflow) to a bare React Native CLI project - `android/` and `ios/` are real, hand-maintained native projects checked into git, not generated/prebuild artifacts. That migration was pure build tooling: no screen, Redux, or API-contract behavior changed.

## Screens

| Web (`HomeControlFrontEnd`) | Mobile (this app) |
| --- | --- |
| `WelcomePage` (public demo + login) | `LoginScreen` |
| `AuthenticatedPage` | `HomeScreen` (Home tab) |
| `DevicesPage` (list + detail toggle) | `DevicesListScreen` + `DeviceDetailScreen` (Devices tab, stacked) |
| `LedStripeWithSensorsDetail` / `OverrideControl` / `AnimationProgressBar` | Same names, under `src/components/devices/`, RN `View`/`StyleSheet` + `react-native-svg` instead of react-bootstrap |

Redux slices (`authSlice`, `devicesSlice`) and the API/hub service layer (`devicesApi.ts`, `deviceHub.ts`) are ported close to verbatim - the data contracts are shared, only the presentation layer differs.

## Look & feel

The app mirrors the web frontend's design: a dark navy theme with a cyan → indigo → violet accent, frosted-style cards, an animated background (drifting colour orbs plus a colour-shifting "LED strip" line, disabled under the OS *reduce motion* setting) and the same custom icon set. Tokens live in `src/theme.ts` (the web's `--hc-*` variables); building blocks are `Background`, `Card`, `Button`, `GradientFill` and `ui.tsx` (`IconTile`, `TypePill`, `SectionLabel`, `ErrorBox`) under `src/components/`, icons in `src/components/icons/Icons.tsx`. Everything is drawn with `react-native-svg` - there is no icon font or gradient library.

Behaviour matches the web app too: sign-in landing page with feature highlights, a Home dashboard with a Devices shortcut and account panel, device list/detail, override buttons that turn into a live progress bar (red for override, green for motion) counting down against **server time** (`serverTimeUtc` → `serverClockOffsetMs` in `devicesSlice`, so a skewed phone clock cannot shift it). Navigation stays native to mobile - bottom tabs plus a stack - instead of the web's slide-in menu; the header carries the user's initial and a log-out button.

## Stack & upgrades

React Native **0.87.1** (New Architecture; Android edge-to-edge is on, per the 0.87 template). Versions are deliberately pinned to what that release supports:

- **`react` / `react-test-renderer` stay at 19.2.3** - React Native ships a renderer built for exactly one React version; a newer `react` fails at runtime with a version-mismatch error even though `npm` would allow it.
- TypeScript 6, ESLint 8, Jest 29 and Prettier 2 are what the 0.87 template and `@react-native/eslint-config` / `jest-preset` target. Newer majors (TypeScript 7, ESLint 10, Jest 30, Prettier 3) are available but unsupported by them.
- To upgrade React Native itself, apply the matching diff from [rn-diff-purge](https://github.com/react-native-community/rn-diff-purge) (`diffs/<from>..<to>.diff`) to `android/`, `ios/`, `package.json` and `tsconfig.json`.

iOS: run `bundle exec pod install` in `ios/` after pulling - `react-native-svg` was added.

## Running it

```
npm install
npm start              # starts Metro
npm run android        # in another terminal - builds and installs the debug app on a device/emulator
```

Or build the debug APK directly with Gradle (what CI/agents use to verify the build):

```
cd android
./gradlew assembleDebug
```

The output APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

**Release APK** (also type-checks, lints and tests first; needs JDK 17 + the Android SDK, installed by `INSTALL_ANDROID=1 ./scripts/setup-ubuntu.sh`): from the repo root run `./build-mobile-release.sh` (`--aab` adds the Play Store bundle). The output is `android/app/build/outputs/apk/release/app-release.apk`. The release build type is signed with `android/app/debug.keystore` (stock React Native template), so it sideloads fine but is **not Play Store ready** - generate your own keystore and point `signingConfigs.release` in `android/app/build.gradle` at it first. `API_BASE_URL` is baked in at build time from `.env`.

Set `API_BASE_URL` (copy `.env.example` to `.env` - read by [`react-native-config`](https://github.com/lugg/react-native-config)) to point at the backend. The default/recommended value is the Azure-hosted backend, `https://homecontrol-app.azurewebsites.net`, which has a publicly-trusted TLS cert and needs no local setup. It **must be `https://`**, not `http://` (see Auth below), whichever backend you point at.

## Auth: how login actually works here

The backend (`HomeControlBackEnd`) uses cookie-session auth via ASP.NET Core's Google OAuth handler - there's no bearer token to hand the app. A mobile app has no browser session to inherit, so `LoginScreen` opens the login page in an **in-app WebView** (`react-native-webview`), not the system browser:

1. The WebView loads `{API_BASE_URL}/api/auth/login?returnUrl=homecontrol://auth-callback`.
2. `AuthController.Login` / `GoogleCallback` (unchanged, plus one addition - see below) run the normal Google OAuth dance and set the session cookie.
3. `GoogleCallback` redirects to `returnUrl` on success. The WebView's `onShouldStartLoadWithRequest` intercepts that navigation *in JS* before the WebView engine would try to resolve `homecontrol://` itself, so this never needs to be a real OS-routable deep link.
4. React Native's own networking (used by `axios` in `api.ts` and by the SignalR client) reads from the same native cookie store the WebView just wrote to, so subsequent API calls are authenticated without the app ever handling the cookie itself.

The `homecontrol://` scheme is still registered at the OS level for parity/robustness, even though step 3 means the login flow never actually needs the OS to resolve it:

- **Android**: a second `<intent-filter>` on `MainActivity` in `android/app/src/main/AndroidManifest.xml`, matching `android:scheme="homecontrol"` `android:host="auth-callback"`.
- **iOS**: `CFBundleURLTypes` in `ios/HomeControlMobile/Info.plist`, listing `homecontrol` as a `CFBundleURLSchemes` entry.

(Previously, under Expo, this was just app.json's `"scheme": "homecontrol"` key, which Expo's prebuild step turned into the same native configuration.)

**Backend change made for this:** `AuthController.GoogleCallback` previously ignored its own `returnUrl` parameter and always redirected to the web app. It now redirects there when `returnUrl` is a same-site relative URL or starts with `homecontrol://` (open-redirect guard - see `IsAllowedReturnUrl`), falling back to today's behavior otherwise. The web app's login flow is unaffected.

### Secure cookie + dev TLS

The auth cookie is `Secure` (`Program.cs`), so it's only stored over an HTTPS connection - except browsers/WebViews special-case `localhost` as "secure enough" even over plain HTTP, which is how the web app's dev flow gets away with an HTTP-facing Vite proxy. Mobile clients generally can't reach the backend via literal `localhost` (an Android emulator needs `10.0.2.2`, a physical device needs the LAN IP), so **the mobile app must talk to the backend over real HTTPS with a certificate that actually validates for that host**.

**This is a non-issue with the default/recommended backend** - `https://homecontrol-app.azurewebsites.net` has a publicly-trusted, CA-issued certificate (Azure App Service's managed cert), so there's nothing to configure. The rest of this section only applies if you point `API_BASE_URL` at a **local** `HomeControlBackEnd` instead, whose dev HTTPS certificate is self-signed for `localhost` only.

The fix, using [mkcert](https://github.com/FiloSottile/mkcert):

```
sudo apt install mkcert libnss3-tools                      # Ubuntu/WSL;  Windows: winget install FiloSottile.mkcert
mkcert -install                                            # trusts a local CA on this machine
cd HomeControlBackEnd
mkdir certs
mkcert -cert-file certs/dev-cert.pem -key-file certs/dev-key.pem localhost 127.0.0.1 ::1 <your LAN IP> 10.0.2.2
openssl pkcs12 -export -out certs/dev-cert.pfx -inkey certs/dev-key.pem -in certs/dev-cert.pem -password pass:devcert
dotnet user-secrets set "Kestrel:Certificates:Default:Path" "certs/dev-cert.pfx"
dotnet user-secrets set "Kestrel:Certificates:Default:Password" "devcert"
```

`certs/` is gitignored - the cert is machine-specific (it's tied to your LAN IP and to a CA only your machine trusts), which is also why it's wired up via `dotnet user-secrets` rather than `launchSettings.json` or `appsettings.json`. Run the backend with `dotnet run --launch-profile https-lan` (a separate profile from the default `https` one - it binds `0.0.0.0` instead of `localhost` so a phone/emulator can actually reach it at all, independent of the cert).

**A physical device also needs the mkcert root CA installed as trusted**, not just the dev machine - `mkcert -install` only trusts it locally. Get the CA file from `mkcert -CAROOT` (a `rootCA.pem`), transfer it to the phone, and install it as a trusted certificate via the OS settings (Android: Settings → Security → Encryption & credentials → Install a certificate → CA certificate; iOS: AirDrop/email it, install the profile, then separately enable full trust for it under Settings → General → About → Certificate Trust Settings). Without this step the phone will still reject the connection even though the cert is technically valid.

There is deliberately no Android network-security-config or "trust user-installed CAs" mechanism in this app - that would weaken TLS validation for every connection, not just a local dev backend. Use mkcert (a real, if locally-scoped, CA) instead.

**Firewall:** a phone on the same Wi-Fi can't reach a local backend (port 7000/5000) or the Metro bundler (port 8081) until the machine allows it. On Ubuntu with `ufw`: `sudo ufw allow 7000,5000,8081/tcp`. If the dev environment runs in Docker/WSL on a Windows host, the **Windows** firewall (and the container's published ports - `docker/dev/docker-compose.yml` publishes 3000/5000/7000) are what matter: either an interactive "allow this app" prompt the first time a connection comes in, or explicit rules (PowerShell, run elevated, once):

```
New-NetFirewallRule -DisplayName "HomeControl Backend HTTPS (dev)" -Direction Inbound -Protocol TCP -LocalPort 7000 -Action Allow -Profile Private,Domain
New-NetFirewallRule -DisplayName "HomeControl Backend HTTP (dev)" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow -Profile Private,Domain
New-NetFirewallRule -DisplayName "HomeControl Mobile Metro (dev)" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private,Domain
```

### SignalR transport

The hub connection (`deviceHub.ts`) is forced to **`HttpTransportType.LongPolling`** only (the web app uses the default negotiation, i.e. WebSockets when available). Two transports are deliberately not offered here:

- **WebSockets** - the hub is authenticated by the session cookie, and React Native's raw WebSocket implementation isn't guaranteed to forward the native cookie store on the upgrade handshake the way XHR/fetch-based transports do. This is the operative reason and is independent of certificate trust.
- **Server-Sent Events** - bare React Native has no global `EventSource` and no polyfill is installed, and `@microsoft/signalr` only wires one up when `typeof EventSource !== 'undefined'`, so requesting it could only ever lose the negotiation to long polling.

The cost is slightly higher latency than a WebSocket. Worth re-testing on a device whether WebSockets carry the cookie reliably on both platforms; if so the restriction can be lifted.

## Environment configuration

Backend URL configuration goes through [`react-native-config`](https://github.com/lugg/react-native-config), which exposes a root-level `.env` file to JS as `Config.*` (via native `BuildConfig` fields on Android / an `Info.plist`-adjacent mechanism on iOS):

```
API_BASE_URL=https://homecontrol-app.azurewebsites.net
```

Copy `.env.example` to `.env` and adjust if you're pointing at a local backend instead - see that file for the emulator/simulator/physical-device address forms. `src/config.ts` reads it as `Config.API_BASE_URL ?? 'https://homecontrol-app.azurewebsites.net'`. Changing `.env` requires a native rebuild (not just a Metro reload) since the value is baked into the native `BuildConfig`/`Info.plist`, not read at JS runtime from `process.env`.

## Known gaps vs. the web app

- Login/unauthorized-account failures still redirect to `/` or `/?error=unauthorized` on the backend (only the success path was changed), so a failed mobile login currently just closes the WebView with a generic error rather than a precise one.
- No offline mode. (Reduced motion *is* honoured: the animated background stops when the OS setting is on.)
- The Android release is debug-signed (see Running it) and iOS has not been built from this environment (needs macOS/Xcode).
