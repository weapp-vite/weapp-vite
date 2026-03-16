import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  shims: true,
  format: ['esm', 'cjs'],
  clean: true,
  dts: true,
  outExtensions({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    }
  },
  target: 'node20',
  failOnWarn: false,
})
