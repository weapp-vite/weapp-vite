import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'vitest': './src/vitest.ts',
    'vitest/setup': './src/vitestSetup.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  failOnWarn: false,
})
