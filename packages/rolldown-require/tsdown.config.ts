import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  shims: true,
  format: ['esm'],
  clean: true,
  dts: true,
  outExtensions() {
    return {
      js: '.mjs',
    }
  },
  deps: {
    neverBundle: ['#module-sync-enabled'],
  },
  target: 'node20',
  failOnWarn: false,
})
