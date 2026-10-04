// Design tokens shared with the web app (HomeControlFrontEnd/src/index.css `--hc-*`), so both
// read as the same product: a deep-navy dark theme with a cyan -> violet accent gradient.
// React Native has no backdrop blur, so "glass" surfaces are simply translucent fills over
// the animated <Background />.
export const colors = {
  bg: '#070b16',
  surface: 'rgba(17, 24, 39, 0.62)',
  surfaceStrong: 'rgba(10, 16, 32, 0.92)',
  surfaceSubtle: 'rgba(148, 163, 184, 0.07)',
  border: 'rgba(148, 163, 184, 0.16)',
  borderStrong: 'rgba(148, 163, 184, 0.3)',
  text: '#e6edf7',
  muted: '#94a3b8',
  accent: '#22d3ee',
  accentSoft: '#67e8f9',
  accent2: '#8b5cf6',
  accent2Soft: '#c4b5fd',
  indigo: '#6366f1',
  success: '#34d399',
  danger: '#fb7185',
  onAccent: '#04111c',
  white: '#ffffff',
  errorBg: 'rgba(244, 63, 94, 0.12)',
  errorBorder: 'rgba(244, 63, 94, 0.35)',
  errorText: '#fda4af',
};

// Brand gradient stops (cyan -> indigo -> violet), same as the web's --hc-gradient.
export const gradient = {
  brand: [colors.accent, colors.indigo, colors.accent2],
  override: ['#f43f5e', '#fb7185'],
  motion: ['#10b981', '#34d399'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};
