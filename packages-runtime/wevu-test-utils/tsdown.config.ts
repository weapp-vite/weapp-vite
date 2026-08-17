import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm'],
  target: 'es2018',
  dts: true,
  clean: true,
  minify: true,
  hash: false,
  unbundle: true,
  sourcemap: false,
  failOnWarn: false,
})
