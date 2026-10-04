// Must be imported before anything else (see index.ts).
//
// React Native ships a minimal `URL` whose properties are read-only getters. @microsoft/signalr builds
// its negotiate URL with `negotiateUrl.pathname += "/negotiate"`, which on Hermes throws
// "TypeError: cannot assign to property 'pathname' which has only a getter" - *before* any network
// request is made. The result: the live-update (SignalR) connection silently never started, and the
// server never saw a /hubs/devices request. This installs a spec-compliant URL/URLSearchParams.
import 'react-native-url-polyfill/auto';
