import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  deps: {
    onlyBundle: false,
  },
  target: 'node20',
  failOnWarn: false,
  sourcemap: true,
})
