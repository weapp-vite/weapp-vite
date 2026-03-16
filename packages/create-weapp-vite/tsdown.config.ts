import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/cli.ts'],
  shims: true,
  format: ['esm'],
  clean: true,
  dts: true,
  outExtensions() {
    return {
      js: '.js',
    }
  },
  target: 'node20',
  failOnWarn: false,
})
