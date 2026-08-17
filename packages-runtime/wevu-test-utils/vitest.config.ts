import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { wevuSfc } from './src/vitest.ts'

const packageDir = import.meta.dirname

export default defineConfig({
  plugins: [wevuSfc()],
  resolve: {
    alias: [
      {
        find: 'wevu/internal-runtime',
        replacement: path.resolve(packageDir, '../wevu/src/internal-runtime.ts'),
      },
      {
        find: 'wevu/internal-reactivity',
        replacement: path.resolve(packageDir, '../wevu/src/internal-reactivity.ts'),
      },
      {
        find: 'wevu/internal-template',
        replacement: path.resolve(packageDir, '../wevu/src/internal-template.ts'),
      },
      {
        find: '@wevu/compiler',
        replacement: path.resolve(packageDir, '../wevu-compiler/src/index.ts'),
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
