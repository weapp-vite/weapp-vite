import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  dts: false,
  entry: ['extension.ts'],
  fixedExtension: false,
  format: ['cjs'],
  outDir: 'dist',
  platform: 'node',
  tsconfig: 'tsconfig.json',
})
