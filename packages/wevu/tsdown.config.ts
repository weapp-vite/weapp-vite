import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/compiler',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: true,
})
