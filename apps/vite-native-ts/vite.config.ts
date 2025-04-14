import path from 'pathe'
import { defineConfig } from 'weapp-vite/config'

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
})
