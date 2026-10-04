import type { ReactNode, SVGProps } from 'react';

// Small hand-drawn icon set (24x24, 2px round strokes, currentColor) so the UI needs no
// icon font or extra dependency. Every icon is decorative by default (aria-hidden); pass
// `title` when one stands alone without a text label.
interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number | string;
  title?: string;
}

function Svg({ size = 20, title, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

// Brand mark: gradient squircle, house outline, three LEDs fading out. Same artwork as
// public/favicon.svg. The gradient id is per-instance-safe because it is never referenced
// from outside this <svg>, and duplicate ids resolve to identical definitions anyway.
export function LogoMark({ size = 32, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <defs>
        <linearGradient id="hc-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#hc-logo-grad)" />
      <g fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 31 32 16l18 15" />
        <path d="M19 28v17h26V28" />
      </g>
      <circle cx="24" cy="38" r="2.4" fill="#fff" />
      <circle cx="32" cy="38" r="2.4" fill="#fff" fillOpacity=".75" />
      <circle cx="40" cy="38" r="2.4" fill="#fff" fillOpacity=".5" />
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5a1 1 0 0 0 1 1H10v-5.5h4v5.5h3.5a1 1 0 0 0 1-1V10" />
  </Svg>
);

// A strip of LEDs: the device type this app controls.
export const LedStripIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="9" width="19" height="6" rx="3" />
    <path d="M7 12h.01M12 12h.01M17 12h.01" strokeWidth={3} />
    <path d="M12 3v2.5M6.5 4.5 8 6.3M17.5 4.5 16 6.3" />
  </Svg>
);

export const DevicesIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2.5" />
    <path d="M8 20h8M12 16v4" />
    <path d="M7.5 10h.01M12 10h.01M16.5 10h.01" strokeWidth={2.6} />
  </Svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Svg>
);

export const LogoutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" />
    <path d="M15 8l4 4-4 4M19 12H9" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 7.7 7 9.5 4.1-1.8 7-5.3 7-9.5V6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);

export const BoltIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />
  </Svg>
);

export const PulseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
  </Svg>
);

export const SparklesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9z" />
    <path d="M19 3v3M17.5 4.5h3" />
  </Svg>
);

export const ServerIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="6.5" rx="2" />
    <rect x="3" y="13.5" width="18" height="6.5" rx="2" />
    <path d="M7 7.25h.01M7 16.75h.01" strokeWidth={2.6} />
  </Svg>
);

export const GoogleIcon = ({ size = 20, ...rest }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width={size}
    height={size}
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3A12 12 0 0 1 12 24a12 12 0 0 1 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7A20 20 0 0 0 24 4a20 20 0 1 0 19.6 16.1z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);
