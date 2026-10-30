import path from 'node:path'
import { defineConfig } from 'vitest/config'

const packageDir = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@weapp-vite/language-service',
        replacement: path.resolve(packageDir, '../../packages/language-service/src/index.ts'),
      },
      {
        find: /^@weapp-vite\/ast(?:\/babel)?$/,
        replacement: path.resolve(packageDir, 'extension/languages/ast.ts'),
      },
      {
        find: '@weapp-vite/ast/babelTypes',
        replacement: path.resolve(packageDir, '../../packages/ast/src/babelTypes.ts'),
      },
    ],
  },
  test: {
    include: ['extension/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
})
