import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    // weapp-vite options
    srcRoot: './miniprogram',
    // platform: 'alipay',
    enhance: {
      autoImportComponents: {
        globs: ['miniprogram/components/**/*'],
      },
    },
    generate: {
      dirs: {
        component: './miniprogram/components',
      },
    },
    npm: {
      enable: false,
    },
  },
  // build: {
  //   rollupOptions: {
  //     output: {
  //       // 将 js 编译成 es5 才能开启
  //       // format: 'es',
  //     },
  //   },
  // },
})
