import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: {
      '@wevu/compiler': fileURLToPath(new URL('../../packages-runtime/wevu-compiler/dist/index.mjs', import.meta.url)),
    },
    include: ['test/**/*.test.ts'],
  },
})
