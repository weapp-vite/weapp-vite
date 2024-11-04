import type { UserConfig } from 'weapp-vite/config'
import path from 'node:path'
import process from 'node:process'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite'

export default <UserConfig>{
  // root: './packageA',
  // build: {
  //   outDir: 'dist/packageA',
  // },
  // weapp: {
  //   srcRoot: 'packageA',
  //   subPackage: {

  //   },
  //   // srcRoot: 'src',
  // },
  // mode: '',
  // mode: 'x',
  // mode: 'xx',
  plugins: process.env.__TEST__
    ? []
    : [
        uvwt({
          rem2rpx: true,
        }),
      // ViteImageOptimizer(),
      ],
  // logLevel: 'info',
  envDir: 'envDir',
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  weapp: {
    jsonAlias: {
      entries: [
        {
          find: '@',
          replacement: path.resolve(__dirname, 'components'),
        },
      ],
    },
    generate: {
      extensions: {
        js: 'ts',
        wxss: 'scss',
      },
    },
    subPackages: {
      packageB: {
        dependencies: [
          // '@vant/weapp',
          // 'dayjs',
          // 'lodash',
          'tdesign-miniprogram',
        ],
        independent: true,
      },
    },
    enhance: {
      wxml: true,
    },
    // subPackages: {
    //   packageA: {
    //     independent: true,
    //   },
    // },
  },
  // build: {
  //   rollupOptions: {
  //     external: ['lodash'],
  //   },
  // },
}
