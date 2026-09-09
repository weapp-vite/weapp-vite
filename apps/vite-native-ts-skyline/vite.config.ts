import { defineConfig } from 'weapp-vite'
import { TDesignResolver } from 'weapp-vite/auto-import-components/resolvers'

export default defineConfig({
  weapp: {
    tailwindcss: {
      rem2rpx: true,
      cssEntries: ['miniprogram/tailwind.css'],
    },
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
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
