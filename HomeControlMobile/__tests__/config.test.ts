/**
 * @format
 */
import { API_BASE_URL, MOBILE_AUTH_CALLBACK_URL, MOBILE_SCHEME } from '../src/config';

// Full-app rendering (App.tsx) pulls in native modules (react-native-webview,
// @preeternal/react-native-cookie-manager, @microsoft/signalr's transports)
// that have no native binary under Jest, so this suite sticks to pure
// config/logic - see __mocks__/react-native-config.js for how the
// react-native-config import itself is stubbed out.
describe('config', () => {
  it('falls back to the Azure-hosted backend when no env override is set', () => {
    expect(API_BASE_URL).toBe('https://homecontrol-app.greenwater-2aa7f6a2.polandcentral.azurecontainerapps.io');
  });

  it('derives the auth callback URL from the mobile scheme', () => {
    expect(MOBILE_SCHEME).toBe('homecontrol');
    expect(MOBILE_AUTH_CALLBACK_URL).toBe('homecontrol://auth-callback');
  });
});
