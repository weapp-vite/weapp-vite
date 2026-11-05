import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { 'index': './src/index.ts', 'core/index': './src/core.ts', 'presets/index': './src/presets/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
})
