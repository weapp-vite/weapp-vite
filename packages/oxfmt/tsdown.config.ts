import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'cli': './src/cli.ts',
    'wxml/index': './src/wxml/index.ts',
    'languages/index': './src/languages/index.ts',
    'project/public': './src/project/public.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
})
