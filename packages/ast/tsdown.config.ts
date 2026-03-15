import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/babel.ts',
    './src/engine.ts',
    './src/types.ts',
    './src/operations/platformApi.ts',
    './src/operations/require.ts',
    './src/operations/scriptSetupImports.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  failOnWarn: false,
})
