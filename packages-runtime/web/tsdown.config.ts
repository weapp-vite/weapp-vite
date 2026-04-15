import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'runtime/index': './src/runtime/index.ts',
    'plugin': './src/plugin.ts',
  },
  dts: true,
  clean: true,
  deps: {
    onlyBundle: false,
  },
  format: ['esm'],
  minify: false,
  sourcemap: true,
  hash: false,
  unbundle: true,
  shims: true,
  tsconfig: './tsconfig.build.json',
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
