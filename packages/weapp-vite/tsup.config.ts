import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'cli': 'src/cli.ts',
    'config': 'src/config.ts',
    'json': 'src/json.ts',
    'volar': 'src/volar.ts',
    'auto-import-components/resolvers': 'src/auto-import-components/resolvers/index.ts',
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
  // external: ['vite'],
})
