import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  oxc: false,
  test: {
    environment: 'node',
    include: ['config/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
