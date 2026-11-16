import { defineConfig } from 'weapp-vite/config'

export default defineConfig(({ mode }) => ({
  build: { outDir: `dist/${mode}` },
  weapp: {
    platform: 'weapp',
    srcRoot: 'src',
    vue: { enable: true },
    multiPlatform: {
      projectConfigs: {
        weapp: {
          appid: 'wx6ffee4673b257014',
          projectname: `issue-1345-wxss-charset-${mode}`,
          compileType: 'miniprogram',
          libVersion: '3.17.4',
          setting: { es6: true, minifyWXML: false },
        },
      },
    },
  },
}))
