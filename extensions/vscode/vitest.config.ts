import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@weapp-vite/ast/babel',
        replacement: path.resolve(__dirname, '../../packages/ast/src/babel.ts'),
      },
      {
        find: '@weapp-vite/ast/babelTypes',
        replacement: path.resolve(__dirname, '../../packages/ast/src/babelTypes.ts'),
      },
    ],
  },
  test: {
    include: ['extension/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
})
