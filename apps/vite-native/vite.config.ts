/* eslint-disable import/first */
// eslint-disable-next-line import/newline-after-import
import { register } from 'tsx/esm/api'
register()
import type { UserConfig } from 'weapp-vite/config'
import path from 'node:path'
import process from 'node:process'

// import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import Inspect from 'vite-plugin-inspect'
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite'
import { TDesignResolver, VantResolver } from 'weapp-vite/auto-import-components/resolvers'

// await import('tsx/esm/api').then(({ register }) => {
//   register()
// })

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
      // Inspect({
      //   build: true,
      //   outputDir: '.vite-inspect',
      // }),
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
        globs: ['components/**/*'],
        resolvers: [
          TDesignResolver(),
          VantResolver(),
        ],
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
    copy: {
      include: ['./pages/index/what-the-fuck.wxss'],
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
