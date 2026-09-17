/**
 * Tailwind-shaped re-export of design tokens.
 *
 * @uride/config/tailwind/preset consumes this so that:
 *   - web (Tailwind in Next.js)
 *   - mobile (NativeWind in Expo)
 * share one source of truth. Edit colors in src/colors.ts — both surfaces update.
 */
import { palette, semantic } from './colors';
import { spacing, radius, elevation } from './spacing';
import { fontFamily, fontSize } from './typography';
import { motion } from './motion';

export const colors = {
  // Brand scales available as `bg-brand-500` etc.
  brand: palette.brand,
  signal: palette.signal,
  neutral: palette.neutral,
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,

  // Semantic tokens — `bg-bg`, `text-text`, `border-border`.
  // Resolve via CSS variables so dark mode swaps without rebuild.
  bg: 'rgb(var(--color-bg) / <alpha-value>)',
  surface: 'rgb(var(--color-surface) / <alpha-value>)',
  'surface-muted': 'rgb(var(--color-surface-muted) / <alpha-value>)',
  border: 'rgb(var(--color-border) / <alpha-value>)',
  text: 'rgb(var(--color-text) / <alpha-value>)',
  'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
  primary: 'rgb(var(--color-primary) / <alpha-value>)',
  'primary-text': 'rgb(var(--color-primary-text) / <alpha-value>)',
  accent: 'rgb(var(--color-accent) / <alpha-value>)',
} as const;

export { spacing, radius, elevation, fontFamily, fontSize, motion, palette, semantic };
