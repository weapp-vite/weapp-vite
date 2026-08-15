import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    multiPlatform: {
      enabled: true,
      targets: ['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs'],
    },
    injectWeapi: {
      enabled: true,
      replaceWx: true,
    },
    web: {
      enable: true,
      outDir: 'dist/web',
      pluginOptions: {
        runtime: {
          routing: {
            mode: 'history',
          },
        },
      },
    },
  },
})
