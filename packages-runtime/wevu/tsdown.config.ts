import { defineConfig } from 'tsdown'

const entry = {
  'index': './src/index.ts',
  'compiler': './src/compiler',
  'internal-reactivity': './src/internal-reactivity',
  'internal-runtime': './src/internal-runtime',
  'internal-template': './src/internal-template',
  'jsx-runtime': './src/jsx-runtime',
  'store': './src/store',
  'api': './src/api',
  'api/vitest': './src/apiVitest',
  'api/vitest/setup': './src/apiVitestSetup',
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
    hash: false,
    unbundle: true,
    deps: {
      resolveDepSubpath: true,
    },
    sourcemap: false,
    failOnWarn: false,
    checks: {
      pluginTimings: false,
    },
  },
  {
    entry,
    outDir: './dist/dev',
    format: ['esm'],
    target: 'es2018',
    dts: false,
    clean: false,
    minify: false,
    hash: false,
    unbundle: true,
    deps: {
      resolveDepSubpath: true,
    },
    sourcemap: true,
    failOnWarn: false,
    checks: {
      pluginTimings: false,
    },
  },
])
