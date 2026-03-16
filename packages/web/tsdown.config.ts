import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'runtime/index': './src/runtime/index.ts',
    'plugin': './src/plugin.ts',
  },
  dts: false,
  clean: true,
  format: ['esm'],
  shims: true,
  outExtensions() {
    return {
      js: '.mjs',
    }
  },
  env: {
    NODE_ENV: 'production',
  },
  target: 'node20',
  failOnWarn: false,
})
