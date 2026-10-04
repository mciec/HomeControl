import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import GradientFill from './GradientFill';
import { colors } from '../theme';

// Fixed, non-interactive backdrop behind the whole app - the native twin of the web's
// .app-background: deep-navy gradient, two slowly drifting colour orbs and a colour-shifting
// "LED strip" line along the bottom edge. Animations are skipped when the OS "reduce motion"
// setting is on.
const STRIP_HEIGHT = 3;

function Orb({ size, color, style }: { size: number; color: string; style: object }) {
  return (
    <Animated.View pointerEvents="none" style={[styles.orb, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="orb" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.5} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#orb)" />
      </Svg>
    </Animated.View>
  );
}

function Background() {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);

  const driftA = useRef(new Animated.Value(0)).current;
  const driftB = useRef(new Animated.Value(0)).current;
  const strip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const alternate = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
    const loops = [
      alternate(driftA, 13000),
      alternate(driftB, 16000),
      Animated.loop(Animated.timing(strip, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true })),
    ];
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [reduceMotion, driftA, driftB, strip]);

  const orbSize = Math.max(width, height) * 0.9;
  const move = (v: Animated.Value, dx: number, dy: number) => ({
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
    ],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <GradientFill colors={['#0a1020', colors.bg, '#05070f']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />

      <Orb size={orbSize} color="#0891b2" style={[{ left: -orbSize * 0.4, top: height * 0.05 }, move(driftA, 60, -50)]} />
      <Orb size={orbSize} color="#6d28d9" style={[{ right: -orbSize * 0.4, top: height * 0.35 }, move(driftB, -70, 60)]} />

      {/* Soft glow rising from the strip. */}
      <Svg style={[styles.glow, { width }]} height={90}>
        <Defs>
          <LinearGradient id="stripGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.indigo} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.indigo} stopOpacity={0.22} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#stripGlow)" />
      </Svg>

      {/* The strip: a gradient twice as wide as the screen whose pattern repeats, slid left by
          exactly one screen width per loop, so the wrap-around is seamless. */}
      <View style={[styles.stripClip, { width }]}>
        <Animated.View
          style={{
            width: width * 2,
            height: STRIP_HEIGHT,
            transform: [{ translateX: strip.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) }],
          }}
        >
          <GradientFill
            colors={[
              colors.accent, colors.indigo, colors.accent2, '#f472b6',
              colors.accent, colors.indigo, colors.accent2, '#f472b6', colors.accent,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
  },
  glow: {
    position: 'absolute',
    left: 0,
    bottom: STRIP_HEIGHT,
  },
  stripClip: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: STRIP_HEIGHT,
    overflow: 'hidden',
  },
});

export default Background;
