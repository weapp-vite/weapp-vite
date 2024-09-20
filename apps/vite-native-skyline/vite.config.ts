import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  plugins: [
    uvwt({
      rem2rpx: true,
    }),
  ],
})
