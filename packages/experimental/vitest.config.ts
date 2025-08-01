import path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    // onConsoleLog(log: string, type: 'stdout' | 'stderr'): boolean | void {
    //   return !(log === 'message from third party library' && type === 'stdout')
    // },
  },
})
