import path from 'pathe'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'weapp-vite/config'

let idx = 0
export default defineConfig({
  weapp: {
    // weapp-vite options
    srcRoot: './miniprogram',
    // platform: 'alipay',
    enhance: {
      autoImportComponents: {
        globs: ['components/**/*'],
      },
    },
    generate: {
      dirs: {
        component: './miniprogram/components',
      },
    },
    npm: {
      // enable: false,
      cache: false,
    },
    worker: {
      entry: ['index'],
    },
  },
  build: {
    rollupOptions: {
      //
      input: [
        path.resolve(import.meta.dirname, './miniprogram/pages/test/aaa.js'),
        path.resolve(import.meta.dirname, './miniprogram/pages/test/bbb.ts'),
      ],
      // treeshake: {
      //   moduleSideEffects: (id, external) => {
      //     // console.log(id, external)
      //     return true
      //   },
      // },
    },
  },
  plugins: [
    visualizer(() => {
      // console.log(options)
      return {
        emitFile: true,
        filename: `stats${idx++}.html`,
      }
    }),
  ],
})
