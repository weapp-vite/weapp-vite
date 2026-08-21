import { wevuSfc } from '@wevu/test-utils/vitest'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    wevuSfc({
      isPage: filename => filename.endsWith('/pages/home/index.vue'),
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
