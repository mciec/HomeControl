import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import GradientFill from './GradientFill';
import { colors, gradient, radius } from '../theme';

type Variant = 'primary' | 'google' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// Shared button: gradient `primary` (the web's .btn-primary), white `google`, translucent `ghost`.
// 48dp tall to stay a comfortable touch target.
function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? colors.onAccent : variant === 'google' ? '#1f2937' : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'google' && styles.google,
        variant === 'ghost' && styles.ghost,
        variant === 'primary' && styles.primaryGlow,
        inactive && styles.inactive,
        pressed && styles.pressed,
        style,
      ]}
    >
      {variant === 'primary' && <GradientFill colors={gradient.brand} />}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            {iconLeft}
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
              {label}
            </Text>
            {iconRight}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  primaryGlow: {
    backgroundColor: colors.indigo,
  },
  google: {
    backgroundColor: colors.white,
  },
  ghost: {
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inactive: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.85,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default Button;
