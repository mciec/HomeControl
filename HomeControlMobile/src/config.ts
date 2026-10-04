import Config from 'react-native-config';

// Backend base URL. Must be an absolute HTTPS URL - the auth cookie is set
// with Secure (see HomeControlBackEnd's AuthController/Program.cs), so it will
// silently fail to persist over a plain http:// connection except on an
// actual "localhost" origin (which mobile clients can't reach; only the web
// dev server's proxy can). Configure per environment via API_BASE_URL in a
// root .env file (see .env.example, and react-native-config's docs) rather
// than editing this default. The default here points at the Azure-hosted
// backend, which has a publicly-trusted TLS cert and needs no local setup.
//
//   - Android emulator -> local backend: use https://10.0.2.2:7000
//   - iOS simulator -> local backend:    https://localhost:7000 works directly
//   - Physical device -> local backend:  https://<your machine's LAN IP>:7000
//
// A local backend's dev HTTPS certificate is self-signed for "localhost"
// only, so hitting it via an emulator alias or LAN IP will fail TLS
// validation unless you trust a cert that covers that host (e.g. via mkcert)
// - see README.md. This does not apply to the Azure default above.
export const API_BASE_URL = Config.API_BASE_URL ?? 'https://homecontrol-app.greenwater-2aa7f6a2.polandcentral.azurecontainerapps.io';

// Must match the intent-filter scheme declared for MainActivity in
// AndroidManifest.xml (and the URL scheme in ios/.../Info.plist), and the
// allow-listed custom-scheme prefix the backend's AuthController checks
// returnUrl against.
export const MOBILE_SCHEME = 'homecontrol';

// Sentinel "return to the app" URL used as the login flow's returnUrl. It
// never needs to resolve as a real OS-level link - react-native-webview
// intercepts navigation to it in JS (see LoginScreen) before the WebView
// engine would try to hand it to the OS - so it's a fixed literal rather than
// something derived from a deep-linking helper at runtime.
export const MOBILE_AUTH_CALLBACK_URL = `${MOBILE_SCHEME}://auth-callback`;
