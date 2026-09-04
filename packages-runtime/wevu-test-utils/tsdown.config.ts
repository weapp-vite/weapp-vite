import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/vitest.ts'],
  format: ['esm'],
  target: 'es2018',
  dts: true,
  clean: true,
  minify: true,
  hash: false,
  unbundle: true,
  deps: {
    resolveDepSubpath: true,
  },
  sourcemap: false,
  failOnWarn: false,
})
