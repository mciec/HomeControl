import { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Provider, useDispatch } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store/store';
import type { AppDispatch } from './src/store/store';
import { checkAuthStatus } from './src/hooks/checkAuthStatus';
import RootNavigator, { navigationTheme } from './src/navigation/RootNavigator';
import Background from './src/components/Background';
import { colors } from './src/theme';

// Mirrors App.tsx's checkAuthStatus effect on the web: resolve whether a
// session cookie is already present before deciding which navigator to show.
function AuthGate() {
  const dispatch = useDispatch<AppDispatch>();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuthStatus(dispatch).finally(() => setChecking(false));
  }, [dispatch]);

  if (checking) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return <RootNavigator />;
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        {/* Android is edge-to-edge (RN 0.87 template default), so the status bar is always
            transparent and the backdrop paints under it - only the icon colour is ours to set. */}
        <StatusBar barStyle="light-content" />
        <View style={styles.root}>
          <Background />
          <NavigationContainer theme={navigationTheme}>
            <AuthGate />
          </NavigationContainer>
        </View>
      </SafeAreaProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.muted,
  },
});
