import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'network-options': './src/networkOptions.ts',
    'vitest': './src/vitest/index.ts',
    'vitest/setup': './src/vitest/setup.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  deps: {
    resolveDepSubpath: true,
  },
  target: 'node18',
  failOnWarn: false,
})
