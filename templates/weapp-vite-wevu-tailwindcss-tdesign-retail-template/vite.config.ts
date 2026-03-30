import path from 'node:path'
import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  weapp: {
    srcRoot: 'src',
    typescript: {
      app: {
        compilerOptions: {
          paths: {
            '@/*': ['./src/*'],
            'tdesign-miniprogram/*': ['./node_modules/tdesign-miniprogram/miniprogram_dist/*'],
          },
        },
      },
    },
    wevu: {
      defaults: {
        component: {
          options: {
            styleIsolation: 'apply-shared',
          },
        },
      },
    },
    // weapp-vite options
  },
  plugins: [
    UnifiedViteWeappTailwindcssPlugin({
      rem2rpx: true,
    }) as any,
  ],
})
