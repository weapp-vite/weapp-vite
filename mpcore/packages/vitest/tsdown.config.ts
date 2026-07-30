import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    setup: './src/setup.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  failOnWarn: false,
})
