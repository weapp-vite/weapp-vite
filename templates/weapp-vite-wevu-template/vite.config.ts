import { defineConfig } from 'weapp-vite/config'

export default defineConfig(() => ({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: {
      globs: ['components/**/*.vue', 'components/**/*.wxml'],
      typedComponents: true,
      vueComponents: true,
      vueComponentsModule: 'wevu',
    },
  },
  // weapp-vite 内置的 Vue 支持会自动处理 .vue 文件，不需要额外插件
}))
