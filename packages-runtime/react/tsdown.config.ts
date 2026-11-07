import { defineConfig } from 'tsdown'
import { syncPackageSkills } from '../../skills/scripts/distribution.mjs'

const entry = {
  index: './src/index.ts',
  renderer: './src/renderer.ts',
  components: './src/components.ts',
  types: './src/types.ts',
}

export default defineConfig([
  {
    entry,
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
    sourcemap: false,
    failOnWarn: false,
    hooks: {
      'build:done': () => syncPackageSkills('@weapp-vite/react'),
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
  },
])
