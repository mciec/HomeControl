import { DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import type { AuthStackParamList, DevicesStackParamList, MainTabParamList } from './types';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import DevicesListScreen from '../screens/DevicesListScreen';
import DeviceDetailScreen from '../screens/DeviceDetailScreen';
import { BrandTitle, HeaderRight } from './HeaderParts';
import { DevicesIcon, HomeIcon } from '../components/icons/Icons';
import { colors } from '../theme';

// Transparent backgrounds everywhere so the animated <Background /> rendered behind the
// NavigationContainer (see App.tsx) shows through every screen.
export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: 'transparent',
    card: colors.surfaceStrong,
    text: colors.text,
    border: colors.border,
    notification: colors.accent2,
  },
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const DevicesStack = createNativeStackNavigator<DevicesStackParamList>();

// Header/tab renderers live at module scope (not inline in the navigators) so React sees stable
// component types across renders.
const renderHeaderRight = () => <HeaderRight />;
const renderBrandTitle = () => <BrandTitle />;
const renderHomeIcon = ({ color, size }: { color: string; size: number }) => <HomeIcon size={size} color={color} />;
const renderDevicesIcon = ({ color, size }: { color: string; size: number }) => (
  <DevicesIcon size={size} color={color} />
);

const stackScreenOptions = {
  headerRight: renderHeaderRight,
  headerTintColor: colors.text,
  headerStyle: { backgroundColor: colors.surfaceStrong },
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: 'transparent' },
};

function DevicesNavigator() {
  return (
    <DevicesStack.Navigator screenOptions={stackScreenOptions}>
      <DevicesStack.Screen name="DevicesList" component={DevicesListScreen} options={{ title: 'Devices' }} />
      <DevicesStack.Screen name="DeviceDetail" component={DeviceDetailScreen} options={{ title: 'Device' }} />
    </DevicesStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerRight: renderHeaderRight,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.surfaceStrong },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceStrong, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <MainTab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: renderBrandTitle,
          title: 'Home',
          tabBarIcon: renderHomeIcon,
        }}
      />
      <MainTab.Screen
        name="Devices"
        component={DevicesNavigator}
        options={{
          headerShown: false,
          title: 'Devices',
          tabBarIcon: renderDevicesIcon,
        }}
      />
    </MainTab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

// Root switch between the unauthenticated and authenticated app, following
// React Navigation's documented "authentication flow" pattern: which
// navigator is mounted - not a screen within one navigator - depends on
// auth state. Mirrors App.tsx's isAuthenticated branch on the web.
function RootNavigator() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  return isAuthenticated ? <MainNavigator /> : <AuthNavigator />;
}

export default RootNavigator;
