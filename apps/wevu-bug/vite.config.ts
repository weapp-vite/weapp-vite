import { defineConfig } from 'weapp-vite'

export default defineConfig(() => ({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
    web: {
      enable: true,
      root: '.',
    },
  },
  // weapp-vite 内置的 Vue 支持会自动处理 .vue 文件，不需要额外插件
}))
