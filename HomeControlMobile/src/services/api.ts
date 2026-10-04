import axios from 'axios';
import { API_BASE_URL, MOBILE_AUTH_CALLBACK_URL } from '../config';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  // React Native's networking stack attaches cookies from its native cookie
  // store automatically (see LoginScreen's WebView-based login), unlike a
  // browser it doesn't gate that on withCredentials - this is set anyway for
  // parity with the web client and in case a given RN/Expo version does key
  // off it.
  withCredentials: true,
});

export const authService = {
  getStatus: async () => {
    const response = await apiClient.get('/auth/status');
    return response.data;
  },

  getUser: async () => {
    const response = await apiClient.get('/auth/user');
    return response.data;
  },

  // Full URL for the login WebView to load. returnUrl is a sentinel the
  // WebView itself intercepts in JS (see LoginScreen) before the OS would
  // ever need to resolve it as a real link, so it's the app's literal custom
  // scheme rather than something derived from the current runtime (which,
  // under Expo Go, would be an exp:// URL the backend's allow-list doesn't
  // recognize - see AuthController.GoogleCallback).
  getLoginUrl: (): string => {
    return `${API_BASE_URL}/api/auth/login?returnUrl=${encodeURIComponent(MOBILE_AUTH_CALLBACK_URL)}`;
  },

  logout: async () => {
    await apiClient.post('/auth/logout');
  },
};

export const sampleService = {
  getPublicData: async () => {
    const response = await apiClient.get('/sample/public');
    return response.data;
  },

  getProtectedData: async () => {
    const response = await apiClient.get('/sample/protected');
    return response.data;
  },
};

export default apiClient;
