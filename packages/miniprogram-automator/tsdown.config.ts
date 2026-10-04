import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    operation: './src/operation/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  deps: {
    onlyBundle: false,
    resolveDepSubpath: true,
  },
  target: 'node20',
  failOnWarn: false,
  sourcemap: false,
})
