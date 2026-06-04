import { WeappTailwindcss } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
  },
  plugins: [
    WeappTailwindcss({
      rem2rpx: true,
    }),
  ],
})
