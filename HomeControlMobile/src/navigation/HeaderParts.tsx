import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { LogoMark } from '../components/icons/Icons';
import { IconTile } from '../components/ui';
import LogoutButton from './LogoutButton';
import { colors } from '../theme';

// Brand lockup used as the Home header title - same "Home" + accent "Control" wordmark as the web navbar.
export function BrandTitle() {
  return (
    <View style={styles.brand}>
      <LogoMark size={30} />
      <Text style={styles.brandText}>
        Home<Text style={styles.brandAccent}>Control</Text>
      </Text>
    </View>
  );
}

// Right side of every header: the signed-in user's initial (the web's nav chip) + log out.
export function HeaderRight() {
  const user = useSelector((state: RootState) => state.auth.user);
  const initial = (user?.name ?? user?.email ?? '?').trim().charAt(0).toUpperCase();
  return (
    <View style={styles.right}>
      <IconTile size={32}>
        <Text style={styles.initial}>{initial}</Text>
      </IconTile>
      <LogoutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  brandAccent: {
    color: colors.accentSoft,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  initial: {
    color: colors.accentSoft,
    fontWeight: '800',
  },
});
