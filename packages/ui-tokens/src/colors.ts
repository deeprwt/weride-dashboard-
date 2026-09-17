/**
 * WeRide color system.
 *
 * Brand: confident teal with a warm signal-amber for action/surge. High-contrast
 * neutrals tuned for outdoor mobile use (drivers will read these in sunlight).
 *
 * Every semantic color resolves to a 50-950 scale so designers and engineers
 * never have to argue about hex codes again.
 */

export const palette = {
  brand: {
    50: '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#06B6D4',
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
    950: '#083344',
  },
  signal: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    950: '#451A03',
  },
  neutral: {
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
    950: '#09090B',
  },
  success: {
    500: '#10B981',
    600: '#059669',
    700: '#047857',
  },
  warning: {
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  danger: {
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },
  info: {
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
  },
} as const;

export const semantic = {
  light: {
    bg: palette.neutral[50],
    surface: '#FFFFFF',
    surfaceMuted: palette.neutral[100],
    border: palette.neutral[200],
    text: palette.neutral[900],
    textMuted: palette.neutral[500],
    textInverse: palette.neutral[50],
    primary: palette.brand[600],
    primaryText: '#FFFFFF',
    accent: palette.signal[500],
    success: palette.success[600],
    warning: palette.warning[600],
    danger: palette.danger[600],
    info: palette.info[600],
  },
  dark: {
    bg: palette.neutral[950],
    surface: palette.neutral[900],
    surfaceMuted: palette.neutral[800],
    border: palette.neutral[800],
    text: palette.neutral[50],
    textMuted: palette.neutral[400],
    textInverse: palette.neutral[900],
    primary: palette.brand[400],
    primaryText: palette.neutral[950],
    accent: palette.signal[400],
    success: palette.success[500],
    warning: palette.warning[500],
    danger: palette.danger[500],
    info: palette.info[500],
  },
} as const;

export type Palette = typeof palette;
export type SemanticColors = typeof semantic.light;
