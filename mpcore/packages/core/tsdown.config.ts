import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  deps: {
    resolveDepSubpath: true,
  },
  target: 'node20',
  failOnWarn: false,
})
