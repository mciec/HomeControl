import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { useDispatch } from 'react-redux';
import { authService, sampleService } from '../services/api';
import { checkAuthStatus } from '../hooks/checkAuthStatus';
import type { AppDispatch } from '../store/store';
import { API_BASE_URL, MOBILE_AUTH_CALLBACK_URL } from '../config';
import Card from '../components/Card';
import Button from '../components/Button';
import { ErrorBox } from '../components/ui';
import { BoltIcon, GoogleIcon, LogoMark, PulseIcon, ShieldIcon } from '../components/icons/Icons';
import { colors, spacing } from '../theme';

function isUnauthorizedRedirect(url: string): boolean {
  // Falls back to today's web behavior when login fails or the account isn't
  // allow-listed (AuthController redirects to "/" or "/?error=unauthorized"
  // in that case, since only the success path honors returnUrl).
  const normalizedBase = API_BASE_URL.replace(/\/+$/, '');
  return url === `${normalizedBase}/` || url === normalizedBase || url.includes('error=unauthorized');
}

const FEATURES = [
  { Icon: PulseIcon, title: 'Live status', text: 'Animations and events update in real time.' },
  { Icon: BoltIcon, title: 'Instant control', text: 'Override a device with a single tap.' },
  { Icon: ShieldIcon, title: 'Private', text: 'Access limited to approved Google accounts.' },
];

// Mirrors WelcomePage.tsx: hero + Google sign-in + feature highlights, with the public API
// check kept as a small secondary link. The login itself runs in an in-app WebView (rather
// than the system browser) so the session cookie Google sign-in leaves behind lands in the
// same native cookie store React Native's own networking reads from - see api.ts and the
// README's auth section for the full reasoning.
function LoginScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const [publicData, setPublicData] = useState<unknown>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const [showLogin, setShowLogin] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleGetPublicData = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const data = await sampleService.getPublicData();
      setPublicData(data);
    } catch {
      setDemoError('Failed to fetch public data');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleNavigationChange = (navState: WebViewNavigation) => {
    if (navState.url.startsWith(MOBILE_AUTH_CALLBACK_URL)) {
      setShowLogin(false);
      setLoginBusy(true);
      checkAuthStatus(dispatch).finally(() => setLoginBusy(false));
      return;
    }
    if (isUnauthorizedRedirect(navState.url)) {
      setShowLogin(false);
      setLoginError('Login failed, or this account is not authorized.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card>
          <View style={styles.body}>
            <View style={styles.hero}>
              <View style={styles.logoRing}>
                <LogoMark size={56} />
              </View>
              <Text style={styles.title}>
                Your home,{'\n'}
                <Text style={styles.titleAccent}>under control</Text>
              </Text>
              <Text style={styles.lead}>
                Monitor and command your connected devices from anywhere - live status, instant overrides, one secure sign-in.
              </Text>
            </View>

            {loginError && <ErrorBox message={loginError} />}

            <Button
              variant="google"
              label="Sign in with Google"
              iconLeft={<GoogleIcon size={22} />}
              loading={loginBusy}
              onPress={() => {
                setLoginError(null);
                setShowLogin(true);
              }}
            />

            <View style={styles.features}>
              {FEATURES.map(({ Icon, title, text }) => (
                <View key={title} style={styles.feature}>
                  <Icon size={22} color={colors.accent} />
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>{title}</Text>
                    <Text style={styles.featureBody}>{text}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              onPress={handleGetPublicData}
              disabled={demoLoading}
              style={styles.link}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>{demoLoading ? 'Checking...' : 'Check API status'}</Text>
            </Pressable>

            {demoError && <ErrorBox message={demoError} />}

            {publicData !== null && (
              <View style={styles.responseBox}>
                <Text style={styles.responseText}>{JSON.stringify(publicData, null, 2)}</Text>
              </View>
            )}
          </View>
        </Card>
      </ScrollView>

      <Modal
        visible={showLogin}
        animationType="slide"
        onRequestClose={() => setShowLogin(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sign in</Text>
            <Pressable onPress={() => setShowLogin(false)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.modalClose}>Cancel</Text>
            </Pressable>
          </View>
          <WebView
            source={{ uri: authService.getLoginUrl() }}
            onNavigationStateChange={handleNavigationChange}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url.startsWith(MOBILE_AUTH_CALLBACK_URL)) {
                // Handled in onNavigationStateChange; cancel the WebView's
                // own attempt to load a scheme it can't render.
                return false;
              }
              return true;
            }}
            incognito={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    flexGrow: 1,
    justifyContent: 'center',
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  logoRing: {
    padding: 14,
    borderRadius: 26,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.indigo,
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 36,
    textAlign: 'center',
  },
  titleAccent: {
    color: colors.accentSoft,
  },
  lead: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  features: {
    gap: 10,
    marginTop: spacing.sm,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  featureBody: {
    color: colors.muted,
    fontSize: 13,
  },
  link: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  linkText: {
    color: colors.muted,
    fontWeight: '600',
  },
  responseBox: {
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
  },
  responseText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.accentSoft,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surfaceStrong,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  modalClose: {
    color: colors.accent,
    fontWeight: '700',
  },
});

export default LoginScreen;
