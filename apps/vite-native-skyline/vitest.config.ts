import path from 'node:path'
import { defineProject } from 'vitest/config'

const __dirname = import.meta.dirname

export default defineProject({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
  },
})
