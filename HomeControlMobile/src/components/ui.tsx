import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import GradientFill from './GradientFill';
import { colors, radius } from '../theme';

// Small shared pieces mirroring the web's .icon-tile, .type-pill, .section-label and error
// alerts, so every screen composes them the same way.

export function IconTile({ children, size = 44 }: { children: ReactNode; size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.32 }]}>
      <GradientFill colors={['rgba(34, 211, 238, 0.16)', 'rgba(139, 92, 246, 0.16)']} />
      {children}
    </View>
  );
}

export function TypePill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  pillText: {
    color: colors.accent2Soft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  errorBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    marginBottom: 12,
  },
  errorText: {
    color: colors.errorText,
  },
});
