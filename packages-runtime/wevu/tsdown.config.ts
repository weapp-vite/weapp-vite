import { defineConfig } from 'tsdown'

const entry = {
  'index': './src/index.ts',
  'compiler': './src/compiler',
  'internal-reactivity': './src/internal-reactivity',
  'internal-runtime': './src/internal-runtime',
  'internal-template': './src/internal-template',
  'store': './src/store',
  'api': './src/api',
  'api/vitest': './src/apiVitest',
  'api/vitest/setup': './src/apiVitestSetup',
  'fetch': './src/fetch',
  'router': './src/router',
  'web-apis': './src/web-apis',
  'vue-demi': './src/vue-demi',
}

const declarationEntry = {
  ...entry,
  'jsx-runtime': './src/jsx-runtime',
  'weapp/jsx-runtime': './src/weapp/jsx-runtime',
  'alipay/jsx-runtime': './src/alipay/jsx-runtime',
  'tt/jsx-runtime': './src/tt/jsx-runtime',
  'miniprogram/jsx-runtime': './src/miniprogram/jsx-runtime',
}

export default defineConfig([
  {
    entry: declarationEntry,
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
