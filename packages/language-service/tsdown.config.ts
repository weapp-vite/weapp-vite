import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { 'index': './src/index.ts', 'project/index': './src/project/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
})
