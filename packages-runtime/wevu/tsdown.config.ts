import { defineConfig } from 'tsdown'

const entry = {
  'index': './src/index.ts',
  'compiler': './src/compiler',
  'jsx-runtime': './src/jsx-runtime',
  'store': './src/store',
  'api': './src/api',
  'fetch': './src/fetch',
  'router': './src/router',
  'web-apis': './src/web-apis',
  'vue-demi': './src/vue-demi',
}

export default defineConfig([
  {
    entry,
    format: ['esm'],
    target: 'es2018',
    dts: true,
    // dts: {
    //   compilerOptions: {
    //     declarationMap: true,
    //   },
    //   sourcemap: true,
    // },
    clean: true,
    minify: true,
    sourcemap: false,
    failOnWarn: false,
  },
  {
    entry,
    outDir: './dist/dev',
    format: ['esm'],
    target: 'es2018',
    dts: false,
    clean: false,
    minify: false,
    sourcemap: true,
    failOnWarn: false,
  },
])
