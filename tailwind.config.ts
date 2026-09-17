import type { Config } from 'tailwindcss';
import preset from '@uride/config/tailwind/preset.cjs';

export default {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    './packages/ui-web/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
