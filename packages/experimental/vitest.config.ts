import path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
      {
        find: '#test',
        replacement: path.resolve(__dirname, '../weapp-vite/test'),
      },
      {
        find: '#src',
        replacement: path.resolve(__dirname, '../weapp-vite/src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    // onConsoleLog(log: string, type: 'stdout' | 'stderr'): boolean | void {
    //   return !(log === 'message from third party library' && type === 'stdout')
    // },
    // printConsoleTrace: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  logLevel: 'info',
})
