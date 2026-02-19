import path from 'pathe'
import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    wevu: {
      defaults: {
        component: {
          options: {
            virtualHost: false,
            styleIsolation: 'apply-shared',
          },
        },
      },
    },
  },
  plugins: [
    UnifiedViteWeappTailwindcssPlugin({
      rem2rpx: true,
      // Keep arbitrary-value classes in JS unchanged to simulate issue #814.
      jsPreserveClass: className => className.includes('[') && className.includes(']'),
      cssEntries: [
        path.resolve(import.meta.dirname, 'src/app.css'),
      ],
    }) as any,
  ],
})
