import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/compiler',
    './src/jsx-runtime',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: true,
  failOnWarn: false,
})
