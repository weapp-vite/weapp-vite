import { defineConfig } from 'tsdown'
import { syncPackageSkills } from '../../skills/scripts/distribution.mjs'

export default defineConfig({
  entry: ['./src/index.ts', './src/resolver.ts'],
  format: ['esm'],
  target: 'es2018',
  dts: true,
  clean: true,
  minify: true,
  hash: false,
  unbundle: true,
  deps: {
    resolveDepSubpath: true,
  },
  sourcemap: true,
  hooks: {
    'build:done': () => syncPackageSkills('@wevu/json-render'),
  },
})
