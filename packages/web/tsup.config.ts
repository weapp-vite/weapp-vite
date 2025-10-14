import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'runtime/index': 'src/runtime/index.ts',
    'plugin': 'src/plugin.ts',
  },
  dts: true,
  clean: true,
  format: ['cjs', 'esm'],
  shims: true,
  splitting: false,
  outExtension({ format }) {
    return {
      js: `.${format === 'esm' ? 'mjs' : 'cjs'}`,
    }
  },
  env: {
    NODE_ENV: 'production',
  },
})
