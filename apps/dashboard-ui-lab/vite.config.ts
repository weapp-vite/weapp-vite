import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const lowBudget = process.env.WEAPP_VITE_DASHBOARD_LAB_LOW_BUDGET === '1'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    jsFormat: 'esm',
    analyze: lowBudget
      ? {
          budgets: {
            totalBytes: 1,
            mainBytes: 1,
            subPackageBytes: 1,
            independentBytes: 1,
            warningRatio: 0.85,
          },
          history: false,
        }
      : undefined,
    npm: {
      enable: false,
    },
    chunks: {
      sharedStrategy: 'duplicate',
      duplicateWarningBytes: 4 * 1024,
    },
  },
  build: {
    minify: false,
    rolldownOptions: {
      output: {
        minify: false,
      },
    },
  },
})
