import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: '@wevu/json-render-components', include: ['*.test.ts'] },
})
