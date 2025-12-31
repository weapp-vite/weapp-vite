import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/compiler',
    './src/store',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
})
