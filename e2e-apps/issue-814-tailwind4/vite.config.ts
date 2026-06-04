import path from 'pathe'
import { WeappTailwindcss } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
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
    WeappTailwindcss({
      rem2rpx: true,
      cssEntries: [
        path.resolve(import.meta.dirname, 'src/app.css'),
      ],
    }),
  ],
})
