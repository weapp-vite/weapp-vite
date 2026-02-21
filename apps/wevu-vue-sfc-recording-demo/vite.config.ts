import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite'
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
  plugins: [
    tailwindcss(),
    UnifiedViteWeappTailwindcssPlugin({
      rem2rpx: true,
      cssEntries: [path.resolve(import.meta.dirname, 'src/app.css')],
    }),
  ],
  // weapp-vite 内置了 Vue SFC 支持
}))
