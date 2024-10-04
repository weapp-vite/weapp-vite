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
  // logLevel: 'info',
  // build:{
  //   watch:{
  //     chokidar:{

  //     }
  //   }
  // }
})
