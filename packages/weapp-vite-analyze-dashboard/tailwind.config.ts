import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './App.vue',
    './**/*.{vue,ts}',
  ],
  theme: {
    extend: {},
  },
} satisfies Config
