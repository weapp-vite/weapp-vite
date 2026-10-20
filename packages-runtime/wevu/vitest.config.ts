import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { createNodeTestSourceTransform } from '../../scripts/vite/nodeTestSourceTransform.ts'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const packageDir = import.meta.dirname

export default defineConfig({
  cacheDir: path.resolve(packageDir, './.vite'),
  oxc: {
    exclude: /.*/,
  },
  plugins: [createNodeTestSourceTransform()],
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(packageDir, './src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('packages-runtime/wevu', {
      clean: false,
      reporter: ['text', 'lcov'],
      exclude: [
        'src/index.ts', // pure export barrel, exclude from coverage
        '**/dist/**',
      ],
    }),
  },
})
