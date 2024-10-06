// import path from 'node:path'
import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: './miniprogram',
    // weapp-vite options
  },
  plugins: [
    // @ts-ignore
    UnifiedViteWeappTailwindcssPlugin({
      rem2rpx: true,
    }),
  ],
  // resolve: {
  //   alias: {
  //     'tdesign-miniprogram': path.resolve(__dirname, './dist/miniprogram_npm/tdesign-miniprogram'),
  //   },
  // },
  // logLevel: 'info',
  // build:{
  //   watch:{
  //     chokidar:{

  //     }
  //   }
  // }
})
