import type { UserConfig } from 'weapp-vite/config'
import process from 'node:process'
// import consola from 'consola'
// import fs from 'fs-extra'
import path from 'pathe'
// import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
// import Inspect from 'vite-plugin-inspect'

import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite'
import { TDesignResolver, VantResolver } from 'weapp-vite/auto-import-components/resolvers'
// import { register } from 'tsx/esm/api'
// register()
// import 'jiti/register'

// await import('tsx/esm/api').then(({ register }) => {
//   register()
// })

const __dirname = import.meta.dirname

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
          cssSelectorReplacement: {
            root: ['page', '.tw-page'],
          },
        }),
      // Inspect({
      //   build: true,
      //   // outputDir: '.vite-inspect',
      // }),
      // ViteImageOptimizer(),
      ],
  // logLevel: 'info',
  envDir: 'envDir',
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api'],
        api: 'modern-compiler',
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
    autoImportComponents: {
      globs: ['components/**/*'],
      resolvers: [
        TDesignResolver(),
        VantResolver(),
      ],
    },
    subPackages: {
      packageB: {
        dependencies: [
          // '@vant/weapp',
          // 'dayjs',
          // 'lodash',
          'tdesign-miniprogram',
          'miniprogram-computed',
        ],
        independent: true,
      },
    },
    copy: {
      include: ['./pages/index/what-the-fuck.wxss'],
    },
    // debug: {
    //   async watchFiles(watchFiles) {
    //     fs.appendFile(
    //       path.resolve(__dirname, 'watchFiles.txt'),
    //       `${watchFiles.join('\n')}\n\n`,
    //     )
    //   },
    //   inspect: {
    //     threshold: 100,
    //     slient: true,
    //     onHookExecution({ hookName, pluginName, duration, args }) {
    //       consola.info(`[${pluginName}] ${hookName.padEnd(20)} ⏱ ${duration.toFixed(2).padStart(6)} ms`)
    //       if (hookName === 'transform') {
    //         consola.info(args[1])
    //       }
    //       else if (hookName === 'load') {
    //         consola.info(args[0])
    //       }
    //     },
    //   },
    // },
    worker: {
      entry: [
        'index',
      ],
    },
  },
  build: {
    minify: false,
    rolldownOptions: {
      // external:[]
    },
  },
}
