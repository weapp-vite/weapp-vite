import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  shims: true,
  format: ['esm'],
  clean: true,
  dts: true,
  deps: {
    onlyBundle: false,
  },
  outExtensions() {
    return {
      js: '.js',
    }
  },
  target: 'node20',
  failOnWarn: false,
})
