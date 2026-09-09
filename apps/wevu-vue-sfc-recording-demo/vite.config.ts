import { defineConfig } from 'weapp-vite'

export default defineConfig(() => ({
  weapp: {
    tailwindcss: {
      rem2rpx: true,
      cssEntries: ['src/app.css'],
    },
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
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
