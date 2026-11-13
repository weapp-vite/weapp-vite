import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  build: { outDir: 'dist', minify: false },
  weapp: {
    srcRoot: 'src',
    platform: 'weapp',
    vue: { enable: true },
    multiPlatform: {
      projectConfigs: {
        weapp: {
          appid: 'wx6ffee4673b257014',
          projectname: 'initial-props-review',
          compileType: 'miniprogram',
          libVersion: '3.17.4',
          setting: { es6: true },
        },
      },
    },
  },
})
