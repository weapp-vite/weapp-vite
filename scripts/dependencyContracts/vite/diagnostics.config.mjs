import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: { tsconfig: false },
  test: {
    environment: 'node',
    include: ['scripts/dependencyContracts/vite/*.diagnostic.ts'],
    fileParallelism: false,
  },
})
