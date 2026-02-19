import type { Config } from 'tailwindcss'

export default {
  content: ['src/**/*.{wxml,js,ts,vue}'],
  corePlugins: {
    preflight: false,
    container: false,
  },
} satisfies Config
