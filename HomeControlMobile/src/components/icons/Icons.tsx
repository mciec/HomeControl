import type { ReactNode } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme';

// Same hand-drawn icon set as the web app (HomeControlFrontEnd/src/components/icons/Icons.tsx):
// 24x24, 2px round strokes. `color` replaces the web's currentColor.
interface IconProps {
  size?: number;
  color?: string;
}

function Icon({ size = 20, color = colors.text, children }: IconProps & { children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

// Brand mark: gradient squircle, house outline, three LEDs fading out.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="hcLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.accent} />
          <Stop offset="1" stopColor={colors.accent2} />
        </LinearGradient>
      </Defs>
      <Rect width={64} height={64} rx={16} fill="url(#hcLogoGrad)" />
      <G fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M14 31 32 16l18 15" />
        <Path d="M19 28v17h26V28" />
      </G>
      <Circle cx={24} cy={38} r={2.4} fill="#fff" />
      <Circle cx={32} cy={38} r={2.4} fill="#fff" fillOpacity={0.75} />
      <Circle cx={40} cy={38} r={2.4} fill="#fff" fillOpacity={0.5} />
    </Svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 11.5 12 4l9 7.5" />
    <Path d="M5.5 10v9.5a1 1 0 0 0 1 1H10v-5.5h4v5.5h3.5a1 1 0 0 0 1-1V10" />
  </Icon>
);

// A strip of LEDs: the device type this app controls.
export const LedStripIcon = (p: IconProps) => (
  <Icon {...p}>
    <Rect x={2.5} y={9} width={19} height={6} rx={3} />
    <Path d="M7 12h.01M12 12h.01M17 12h.01" strokeWidth={3} />
    <Path d="M12 3v2.5M6.5 4.5 8 6.3M17.5 4.5 16 6.3" />
  </Icon>
);

export const DevicesIcon = (p: IconProps) => (
  <Icon {...p}>
    <Rect x={3} y={4} width={18} height={12} rx={2.5} />
    <Path d="M8 20h8M12 16v4" />
    <Path d="M7.5 10h.01M12 10h.01M16.5 10h.01" strokeWidth={2.6} />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m9 6 6 6-6 6" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" />
    <Path d="M15 8l4 4-4 4M19 12H9" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 3 5 6v5.5c0 4.2 2.9 7.7 7 9.5 4.1-1.8 7-5.3 7-9.5V6z" />
    <Path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
);

export const BoltIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />
  </Icon>
);

export const PulseIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
  </Icon>
);

export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3A12 12 0 0 1 12 24a12 12 0 0 1 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7A20 20 0 0 0 24 4a20 20 0 1 0 19.6 16.1z" />
      <Path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </Svg>
  );
}
