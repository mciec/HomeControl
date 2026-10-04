import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import type { AnimationSource, OverrideDirection } from '../../services/devicesApi';
import GradientFill from '../GradientFill';
import { ArrowLeftIcon, ArrowRightIcon } from '../icons/Icons';
import { colors, gradient, radius } from '../../theme';

interface AnimationProgressBarProps {
  animationName: string;
  direction: OverrideDirection;
  source: AnimationSource;
  startedAtUtc: string;
  endsAtUtc: string;
}

const TICK_INTERVAL_MS = 200;

// Replaces an override button for the duration of its direction's animation.
// The fill is anchored to the side the animation travels away from, so a Left
// animation drains right-to-left (its trailing right edge recedes) and a
// Right animation drains left-to-right (mirrored) - matching the physical
// direction the LEDs move. The label sits in its own full-width layer on top
// of the fill so it stays fully readable no matter how far the bar has drained.
function AnimationProgressBar({ animationName, direction, source, startedAtUtc, endsAtUtc }: AnimationProgressBarProps) {
  const startTime = Date.parse(startedAtUtc);
  const endTime = Date.parse(endsAtUtc);

  // endsAtUtc is a server-time instant; count down against server time (local
  // clock + measured offset) so a skewed device clock can't shift the bar.
  const clockOffsetMs = useSelector((state: RootState) => state.devices.serverClockOffsetMs);

  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, endTime - (Date.now() + clockOffsetMs)));

  useEffect(() => {
    // Re-sync immediately in case props changed since the initial render.
    setRemainingMs(Math.max(0, endTime - (Date.now() + clockOffsetMs)));

    const intervalId = setInterval(() => {
      const next = Math.max(0, endTime - (Date.now() + clockOffsetMs));
      setRemainingMs(next);
      if (next === 0) {
        clearInterval(intervalId);
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAtUtc, endsAtUtc, clockOffsetMs]);

  const totalDurationMs = endTime - startTime;
  const percentRemaining =
    totalDurationMs > 0 ? Math.min(100, Math.max(0, (remainingMs / totalDurationMs) * 100)) : 0;
  const fillColors = source === 'Override' ? gradient.override : gradient.motion;
  const glowColor = source === 'Override' ? '#f43f5e' : '#10b981';

  // Mirrors the web's `transition: width 200ms linear` between ticks.
  const fillAnim = useRef(new Animated.Value(percentRemaining)).current;
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: percentRemaining,
      duration: TICK_INTERVAL_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [percentRemaining, fillAnim]);

  const fillWidth = fillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percentRemaining) }}
    >
      <Animated.View
        style={[
          styles.fill,
          direction === 'Left' ? styles.fillLeft : styles.fillRight,
          { width: fillWidth, shadowColor: glowColor },
        ]}
      >
        <GradientFill colors={fillColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
      </Animated.View>
      {/* Own layer on top of the fill and the track behind it, so the label stays fully
          readable at any fill level instead of only where it overlaps the colored portion. */}
      <View style={styles.labelLayer} pointerEvents="none">
        {direction === 'Left' && <ArrowLeftIcon size={18} color={colors.white} />}
        <Text style={styles.labelText} numberOfLines={1}>
          {source === 'Override' ? 'Override' : 'Motion'} {direction} — {animationName}
        </Text>
        {direction === 'Right' && <ArrowRightIcon size={18} color={colors.white} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 48,
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  fillLeft: {
    left: 0,
  },
  fillRight: {
    right: 0,
  },
  labelLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  labelText: {
    flexShrink: 1,
    color: colors.white,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});

export default AnimationProgressBar;
