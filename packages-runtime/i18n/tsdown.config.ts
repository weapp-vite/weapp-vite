import { defineConfig } from 'tsdown'

const runtimeEntry = {
  index: './src/index.ts',
  runtime: './src/runtime.ts',
}

export default defineConfig([
  {
    entry: {
      ...runtimeEntry,
      cli: './src/cli.ts',
      compiler: './src/compiler.ts',
    },
    format: ['esm'],
    hash: false,
    target: 'node20',
    dts: true,
    clean: true,
    outExtensions() {
      return { js: '.mjs' }
    },
    deps: {
      alwaysBundle: ['@weapp-core/constants'],
    },
    failOnWarn: false,
  },
  {
    entry: {
      ...runtimeEntry,
      compiler: './src/compiler.ts',
    },
    outDir: './dist/cjs',
    format: ['cjs'],
    hash: false,
    target: 'node20',
    dts: false,
    clean: false,
    outExtensions() {
      return { js: '.cjs' }
    },
    deps: {
      alwaysBundle: ['@weapp-core/constants'],
    },
    failOnWarn: false,
  },
  {
    entry: {
      index: './src/index.ts',
    },
    outDir: './dist/miniprogram',
    format: ['cjs'],
    hash: false,
    target: 'es2018',
    dts: false,
    clean: false,
    outExtensions() {
      return { js: '.js' }
    },
    deps: {
      alwaysBundle: ['@weapp-core/constants'],
    },
    copy: [{
      from: './miniprogram.package.json',
      rename: 'package.json',
      to: './dist/miniprogram',
    }],
    failOnWarn: false,
  },
])
