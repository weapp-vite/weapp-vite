import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

export default defineProject({
  test: {
    alias: [
      {
        find: '@/',
        replacement: `${path.resolve(__dirname, './src')}/`,
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('packages-runtime/wevu-compiler', {
      clean: false,
      exclude: [
        '**/dist/**',
      ],
    }),
  },
})
