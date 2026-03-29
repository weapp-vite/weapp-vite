import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'cli': './src/cli.ts',
    'config': './src/config.ts',
    'json': './src/json.ts',
    'volar': './src/volar.ts',
    'runtime': './src/plugins/vue/runtime.ts',
    'mcp': './src/mcp.ts',
    'auto-import-components/resolvers': './src/auto-import-components/resolvers/index.ts',
    'auto-routes': './src/auto-routes.ts',
    'types': './src/types/index.ts',
  },
  dts: true,
  clean: true,
  format: ['esm'],
  shims: true,
  outExtensions() {
    return {
      js: '.mjs',
    }
  },
  env: {
    NODE_ENV: 'production',
  },
  deps: {
    onlyBundle: false,
    neverBundle: [
      '@swc/core',
      '@weapp-vite/ast',
      '@weapp-vite/ast/babel',
      '@weapp-vite/ast/babelCore',
      '@weapp-vite/ast/babelTraverse',
      '@weapp-vite/ast/babelTypes',
      '@weapp-vite/ast/operations/onPageScroll',
      '@weapp-vite/ast/operations/setDataPick',
      '@babel/preset-env',
      '@babel/preset-typescript',
      'cac',
      'chokidar',
      'comment-json',
      'debug',
      'fdir',
      'htmlparser2',
      'local-pkg',
      'lru-cache',
      'magic-string',
      'merge',
      'p-queue',
      'package-manager-detector',
      'postcss',
      'rimraf',
      'semver/functions/gte.js',
      'semver/functions/satisfies.js',
      'semver/functions/valid.js',
      'vue/compiler-sfc',
    ],
  },
  target: 'node20',
  failOnWarn: false,
  hooks: {
    'build:done': async () => {
      const { syncPackageDocs } = await import('./scripts/sync-package-docs.mjs')
      await syncPackageDocs()
    },
  },
})
