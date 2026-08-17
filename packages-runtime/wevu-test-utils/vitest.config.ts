import path from 'node:path'
import { defineConfig } from 'vitest/config'

const packageDir = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'wevu/internal-runtime',
        replacement: path.resolve(packageDir, '../wevu/src/internal-runtime.ts'),
      },
      {
        find: 'wevu',
        replacement: path.resolve(packageDir, '../wevu/src/index.ts'),
      },
      {
        find: '@weapp-core/constants',
        replacement: path.resolve(packageDir, '../../@weapp-core/constants/src/index.ts'),
      },
    ],
  },
  test: {
    include: ['src/**/*.test.ts'],
    globals: true,
  },
})
