import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    'src/**/*.{wxml,js,ts,vue}',
  ],
  theme: {
    extend: {},
  },
  corePlugins: {
    preflight: false,
  },
}

export default config
