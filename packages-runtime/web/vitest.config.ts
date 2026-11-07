import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const packageDir = import.meta.dirname

export default defineProject({
  root: packageDir,
  name: '@weapp-vite/web',
  test: {
    globals: true,
    environment: 'node',
    alias: [
      {
        find: '@weapp-vite/web/runtime',
        replacement: path.resolve(packageDir, './src/runtime'),
      },
      {
        find: '@weapp-vite/web',
        replacement: path.resolve(packageDir, './src'),
      },
    ],
    coverage: createProjectCoverage('packages-runtime/web', {
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        '**/dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    }),
  },
})
