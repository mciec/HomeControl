import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { sampleService } from '../services/api';
import type { RootState } from '../store/store';
import type { MainTabParamList } from '../navigation/types';
import Card from '../components/Card';
import { ErrorBox, IconTile, SectionLabel } from '../components/ui';
import { ChevronRightIcon, LedStripIcon, ShieldIcon } from '../components/icons/Icons';
import { colors, radius, spacing } from '../theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

// Mirrors AuthenticatedPage.tsx: greeting, a Devices shortcut, the account panel, and the
// protected-API check as a small secondary link.
function HomeScreen({ navigation }: Props) {
  const user = useSelector((state: RootState) => state.auth.user);
  const [protectedData, setProtectedData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetProtectedData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sampleService.getProtectedData();
      setProtectedData(data);
    } catch {
      setError('Failed to fetch protected data');
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.name?.split(' ')[0];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Welcome back{firstName ? `, ${firstName}` : ''}</Text>
      <Text style={styles.subheading}>Here's your home at a glance.</Text>

      <Card style={styles.gap}>
        <Pressable
          style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
          onPress={() => navigation.navigate('Devices')}
          accessibilityRole="button"
          accessibilityLabel="Devices, view status and send overrides"
        >
          <IconTile>
            <LedStripIcon size={24} color={colors.accentSoft} />
          </IconTile>
          <View style={styles.shortcutText}>
            <Text style={styles.shortcutTitle}>Devices</Text>
            <Text style={styles.shortcutBody}>View status and send overrides</Text>
          </View>
          <ChevronRightIcon size={20} color={colors.muted} />
        </Pressable>
      </Card>

      <Card>
        <View style={styles.cardBody}>
          <SectionLabel>Account</SectionLabel>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statKey}>Name</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {user?.name}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statKey}>Email</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statKey}>Sign-in</Text>
              <View style={styles.statProvider}>
                <ShieldIcon size={16} color={colors.success} />
                <Text style={styles.statValue}>Google</Text>
              </View>
            </View>
          </View>

          <Pressable onPress={handleGetProtectedData} disabled={loading} style={styles.link} accessibilityRole="button">
            <Text style={styles.linkText}>{loading ? 'Checking...' : 'Check protected API'}</Text>
          </Pressable>

          {error && <ErrorBox message={error} />}

          {protectedData !== null && (
            <View style={styles.responseBox}>
              <Text style={styles.responseText}>{JSON.stringify(protectedData, null, 2)}</Text>
            </View>
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subheading: {
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  gap: {
    marginBottom: spacing.sm + 4,
  },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  pressed: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  shortcutText: {
    flex: 1,
  },
  shortcutTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  shortcutBody: {
    color: colors.muted,
    fontSize: 13,
  },
  cardBody: {
    padding: spacing.lg - 4,
  },
  stats: {
    gap: 10,
  },
  stat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statKey: {
    color: colors.muted,
  },
  statValue: {
    flexShrink: 1,
    color: colors.text,
    fontWeight: '700',
  },
  statProvider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  link: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: spacing.sm,
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
    marginTop: spacing.sm,
  },
  responseText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.accentSoft,
  },
});

export default HomeScreen;
