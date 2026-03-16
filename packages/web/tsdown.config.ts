import { defineConfig } from 'tsdown'

function createConfig(entry: Record<string, string>, clean: boolean) {
  return defineConfig({
    entry,
    dts: true,
    clean,
    format: ['esm'],
    shims: true,
    tsconfig: './tsconfig.build.json',
    outExtensions() {
      return {
        js: '.mjs',
      }
    },
    env: {
      NODE_ENV: 'production',
    },
    target: 'node20',
    failOnWarn: false,
  })
}

export default [
  createConfig({ index: './src/index.ts' }, true),
  createConfig({ 'runtime/index': './src/runtime/index.ts' }, false),
  createConfig({ plugin: './src/plugin.ts' }, false),
]
