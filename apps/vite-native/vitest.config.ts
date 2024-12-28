import path from 'node:path'
import { defineProject } from 'vitest/config'

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
    exclude: [
      '**\/node_modules/**',
      '**\/dist/**',
      '**\/cypress/**',
      '**\/.{idea,git,cache,output,temp}/**',
      '**\/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      'test/index.test.ts',
    ],
  },
})
