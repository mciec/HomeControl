import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface GradientFillProps {
  colors: readonly string[];
  // Direction as 0..1 fractions of the box; defaults to the web's 135deg (top-left -> bottom-right).
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

// Absolutely-positioned linear-gradient background for any container (buttons, icon tiles,
// progress fills). Built on react-native-svg so no extra native gradient library is needed.
function GradientFill({ colors, start = { x: 0, y: 0 }, end = { x: 1, y: 1 } }: GradientFillProps) {
  const id = `g${useId().replace(/:/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
          {colors.map((c, i) => (
            <Stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export default GradientFill;
