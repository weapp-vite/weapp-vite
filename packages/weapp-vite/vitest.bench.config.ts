import path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
  define: {
    'process.env.__TEST__': JSON.stringify(true),
  },
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
      {
        find: 'weapp-vite/auto-routes',
        replacement: path.resolve(__dirname, './src/auto-routes.ts'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: {
      enabled: false,
    },
    benchmark: {
      include: [
        'bench/**/*.bench.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
      ],
      outputJson: `./bench/results/${Date.now()}.json`,
    },
  },
})
