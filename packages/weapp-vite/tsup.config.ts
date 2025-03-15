import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'cli': 'src/cli.ts',
    'config': 'src/config.ts',
    'json': 'src/json.ts',
    'volar': 'src/volar.ts',
    'auto-import-components/resolvers': 'src/auto-import-components/resolvers/index.ts',
    'types': 'src/types/index.ts',
  },
  dts: true,
  clean: true,
  format: ['cjs', 'esm'],
  shims: true,
  outExtension({ format }) {
    return {
      js: `.${format === 'esm' ? 'mjs' : 'cjs'}`,
    }
  },
  cjsInterop: true,
  splitting: true,
  // target: 'esnext',
  // sourcemap: true,
  env: {
    NODE_ENV: 'production',
  },

  // @ts-ignore
  // swc: false,
  // target: 'esnext',
  // https://tsup.egoist.dev/#compile-time-environment-variables
  // https://tsup.egoist.dev/#external-dependencies
  // external: ['vite'],
})
