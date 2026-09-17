/**
 * System-first type. Defer the brand-font conversation until we have a
 * designer; in the meantime use `Inter`-equivalent system stacks for crisp
 * mobile + web rendering.
 */
export const fontFamily = {
  sans: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ],
  mono: [
    'ui-monospace',
    'SFMono-Regular',
    'Menlo',
    'Consolas',
    '"Liberation Mono"',
    'monospace',
  ],
} as const;

/**
 * Type ramp (size in px, line-height as a unitless multiplier).
 * Used by both the web (Tailwind fontSize) and the mobile design system.
 */
export const fontSize = {
  xs: ['12px', { lineHeight: '1.4' }],
  sm: ['14px', { lineHeight: '1.5' }],
  base: ['16px', { lineHeight: '1.55' }],
  lg: ['18px', { lineHeight: '1.5' }],
  xl: ['20px', { lineHeight: '1.4' }],
  '2xl': ['24px', { lineHeight: '1.35' }],
  '3xl': ['30px', { lineHeight: '1.3' }],
  '4xl': ['36px', { lineHeight: '1.2' }],
  '5xl': ['48px', { lineHeight: '1.1' }],
  '6xl': ['60px', { lineHeight: '1.05' }],
} as const;
