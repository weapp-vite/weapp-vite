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
      // 负向对照：仅通过公开选项保留 JavaScript 中的任意值类名。
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
