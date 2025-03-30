import path from 'node:path'
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  plugins: [
    uvwt({
      rem2rpx: true,
    }),
  ],
  resolve: {
    alias: {
      '@vant/weapp/common/index.css': path.resolve(__dirname, './node_modules/@vant/weapp/dist/common/index.wxss'),
    },
  },
})
