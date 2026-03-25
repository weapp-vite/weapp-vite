import type { Config } from 'tailwindcss'
import { addDynamicIconSelectors } from '@iconify/tailwind4'

export default {
  content: [
    './index.html',
    './src/**/*.{vue,ts}',
  ],
  plugins: [
    addDynamicIconSelectors({
      prefix: 'icon',
    }),
  ],
  theme: {
    extend: {},
  },
} satisfies Config
