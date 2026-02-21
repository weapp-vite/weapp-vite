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
  // weapp-vite 内置了 Vue SFC 支持
}))
