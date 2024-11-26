import type { UserConfig } from 'weapp-vite/config'
import path from 'node:path'
import process from 'node:process'
// import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import Inspect from 'vite-plugin-inspect'
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
        Inspect({
          build: true,
          outputDir: '.vite-inspect',
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
      dirs: {
        component: 'components',
        page: 'pages',
      },
      filenames: {
        component: 'index',
        page: 'index',
      },
    },
    enhance: {
      autoImportComponents: {
        dirs: ['components/**/*'],
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
    // enhance: {
    //   wxml: true,
    // },
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
