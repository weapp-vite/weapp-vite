import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
