import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'cli': 'src/cli.ts',
    'config': 'src/config.ts',
    'json': 'src/json.ts',
    'volar': 'src/volar.ts',
    'runtime': 'src/plugins/vue/runtime.ts',
    'auto-import-components/resolvers': 'src/auto-import-components/resolvers/index.ts',
    'auto-routes': 'src/auto-routes.ts',
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
  external: [
    '@swc/core',
    // Babel 相关包 - 只在开发时使用，不需要打包
    '@babel/core',
    '@babel/parser',
    '@babel/traverse',
    '@babel/types',
    '@babel/preset-env',
    '@babel/preset-typescript',
    'vue/compiler-sfc',
  ],
})
