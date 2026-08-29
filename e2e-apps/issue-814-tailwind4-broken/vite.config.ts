import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
    tailwindcss: {
      rem2rpx: true,
      // Keep arbitrary-value classes in JS unchanged to simulate issue #814.
      jsPreserveClass: className => className.includes('[') && className.includes(']'),
      cssEntries: ['src/app.css'],
    },
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
})
