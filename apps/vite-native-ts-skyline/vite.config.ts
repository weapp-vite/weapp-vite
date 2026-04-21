// import path from 'node:path'
import { weappTailwindcss } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite'
import { TDesignResolver } from 'weapp-vite/auto-import-components/resolvers'

export default defineConfig({
  weapp: {
    srcRoot: './miniprogram',
    typescript: {
      app: {
        compilerOptions: {
          paths: {
            'tdesign-miniprogram/*': ['./node_modules/tdesign-miniprogram/miniprogram_dist/*'],
          },
        },
      },
    },
    autoImportComponents: {
      globs: ['miniprogram/components/**/*'],
      resolvers: [
        TDesignResolver(
          {
          },
        ),
      ],
    },
    // weapp-vite options
  },
  plugins: [
    weappTailwindcss({
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
