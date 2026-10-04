import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { authService } from '../services/api';
import { logout } from '../store/authSlice';
import { LogoutIcon } from '../components/icons/Icons';
import { colors } from '../theme';

// Shared header action across both tabs, mirroring the web app's menu "Log out" item.
function LogoutButton() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch {
      // Fall through to a client-side logout regardless - matches the web
      // app's intent (the cookie clearing on the server is best-effort).
    } finally {
      dispatch(logout());
      setLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handleLogout}
      disabled={loading}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Log out"
      hitSlop={6}
    >
      {loading ? <ActivityIndicator size="small" color={colors.accent} /> : <LogoutIcon size={20} color={colors.text} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  },
});

export default LogoutButton;
