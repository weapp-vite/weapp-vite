import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/babel.ts',
    './src/engine.ts',
    './src/types.ts',
    './src/operations/componentProps.ts',
    './src/operations/featureFlags.ts',
    './src/operations/jsxAutoComponents.ts',
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
