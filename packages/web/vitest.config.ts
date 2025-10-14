import path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
  name: '@weapp-vite/web',
  test: {
    globals: true,
    environment: 'node',
    alias: [
      {
        find: '@weapp-vite/web/runtime',
        replacement: path.resolve(__dirname, './src/runtime'),
      },
      {
        find: '@weapp-vite/web',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
  },
})
