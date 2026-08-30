import path from 'node:path'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
    },
  },
  weapp: {
    srcRoot: 'src',
    tailwindcss: {
      rem2rpx: true,
      cssEntries: ['src/app.css'],
    },
    chunks: {
      sharedStrategy: 'hoist',
    },
    json: {
      defaults: {
        page: {
          navigationStyle: 'custom',
        },
        component: {
          styleIsolation: 'apply-shared',
        },
      },
    },
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
})
